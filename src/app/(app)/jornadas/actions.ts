"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { fmtARS } from "@/lib/finanzas";
import { sendPushToUsers } from "@/lib/push";
import { precioJornada } from "@/lib/jornada";
import { AREA_PM } from "@/lib/tareas/puerta";
import { aRegistro } from "@/lib/jornadas/cargar";
import { avisoJornadaLista } from "@/lib/jornadas/registro";
import type { AppUser } from "@/lib/types";
import { anotar, anotarCambios, nombresParaHistorial } from "@/lib/jornadas/historial-run";

/**
 * Jornadas de producción (23/10/2026). Luz las carga y confirma los datos
 * reales; el dueño cobra, paga y lo marca. Ver lib/jornadas/registro.ts.
 */

const esPM = (u: AppUser) => u.area === AREA_PM || u.area_secundaria === AREA_PM;

async function quienCarga() {
  const me = await requireUser();
  if (me.rol !== "admin" && !esPM(me)) throw new Error("Solo dirección y la project manager.");
  return me;
}

async function soloDueno() {
  const me = await requireUser();
  if (me.rol !== "admin") throw new Error("Esto lo marca dirección.");
  return me;
}

function revalidar() {
  revalidatePath("/jornadas");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/coordinacion/sueldos");
}

const envolver = async <T,>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
};

export interface JornadaForm {
  fecha: string;
  horaInicio: string | null;
  horas: number;
  /** Lo que vale el trabajo. Si no viene, sale de las horas. */
  monto?: number | null;
  clienteId: string | null;
  lugar: string | null;
  notas: string | null;
  /** [0] dirige, [1] acompaña. */
  asistentes: string[];
  viaticosDetalle: Record<string, number>;
  viaticosLosPaga: "cliente" | "agencia";
}

function validar(f: JornadaForm): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return "Elegí la fecha.";
  if (f.horaInicio && !/^\d{2}:\d{2}$/.test(f.horaInicio)) return "La hora tiene que ser HH:MM.";
  if (!(f.horas > 0 && f.horas <= 14)) return "La duración tiene que ser entre media hora y 14 horas.";
  if (!f.asistentes.length) return "Elegí quién dirige la jornada.";
  if (new Set(f.asistentes).size !== f.asistentes.length) return "El acompañante tiene que ser otra persona.";
  if (Object.values(f.viaticosDetalle).some((v) => !(v >= 0))) return "Los viáticos no pueden ser negativos.";
  return null;
}

function fila(f: JornadaForm) {
  const detalle = Object.fromEntries(f.asistentes.map((id) => [id, Math.round(Number(f.viaticosDetalle[id] ?? 0) || 0)]));
  return {
    fecha: f.fecha,
    periodo: f.fecha.slice(0, 7),
    hora_inicio: f.horaInicio || null,
    horas: f.horas,
    monto: f.monto && f.monto > 0 ? Math.round(f.monto) : precioJornada(f.horas),
    cliente_id: f.clienteId || null,
    lugar: f.lugar?.trim() || null,
    notas: f.notas?.trim() || null,
    asistentes: f.asistentes,
    viaticos_detalle: detalle,
    viaticos: Object.values(detalle).reduce((a, b) => a + b, 0),
    viaticos_los_paga: f.viaticosLosPaga === "cliente" ? "cliente" : "agencia",
  };
}

/** Si la jornada tiene su evento en la Agenda, se mueve con ella. */
async function moverEnAgenda(id: string, f: JornadaForm) {
  if (!f.horaInicio) return;
  const inicio = new Date(`${f.fecha}T${f.horaInicio}:00-03:00`);
  const fin = new Date(inicio.getTime() + f.horas * 3_600_000);
  await createAdmin()
    .from("internal_meetings")
    .update({ starts_at: inicio.toISOString(), ends_at: fin.toISOString(), client_id: f.clienteId || null })
    .eq("production_session_id", id);
}

export async function guardarJornada(id: string | null, f: JornadaForm) {
  return envolver(async () => {
    const me = await quienCarga();
    const err = validar(f);
    if (err) return { error: err };
    const admin = createAdmin();
    if (id) {
      const { data: antes } = await admin.from("production_sessions").select("*").eq("id", id).maybeSingle();
      if (!antes) return { error: "No encontré la jornada." };
      const nueva = fila(f);
      const { error } = await admin.from("production_sessions").update(nueva).eq("id", id);
      if (error) return { error: error.message };
      await moverEnAgenda(id, f);
      await anotarCambios(admin, id, me.id, "Modificó la jornada", antes, nueva);
    } else {
      const { data, error } = await admin.from("production_sessions").insert({ ...fila(f), creado_por_id: me.id }).select("id").single();
      if (error || !data) return { error: error?.message ?? "No se pudo cargar." };
      await anotar(admin, data.id, me.id, "Cargó la jornada");
    }
    revalidar();
    return { ok: true as const };
  });
}

/** Luz confirma los datos reales (duración y viáticos): le llega al dueño qué cobrar y qué pagar. */
export async function confirmarJornada(id: string) {
  return envolver(async () => {
    const me = await quienCarga();
    const admin = createAdmin();
    const { data: s } = await admin.from("production_sessions").select("*").eq("id", id).maybeSingle();
    if (!s) return { error: "No encontré la jornada." };
    const { error } = await admin
      .from("production_sessions")
      .update({ confirmada_at: new Date().toISOString(), confirmada_por_id: me.id })
      .eq("id", id);
    if (error) return { error: error.message };
    await anotar(admin, id, me.id, "Confirmó los datos reales");

    const [{ data: cli }, { data: users }] = await Promise.all([
      s.cliente_id ? admin.from("clients").select("id, nombre").eq("id", s.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from("users").select("id, nombre, rol").eq("activo", true),
    ]);
    const lista = (users ?? []) as { id: string; nombre: string; rol: string }[];
    const nombre = (uid: string) => lista.find((u) => u.id === uid)?.nombre.split(" ")[0] ?? "—";
    const j = aRegistro(s as Record<string, unknown>, new Map(), new Set());
    const mensaje = avisoJornadaLista((cli as { nombre: string } | null)?.nombre ?? "sin cliente", j, nombre, fmtARS);
    const duenos = lista.filter((u) => u.rol === "admin" && u.id !== me.id).map((u) => u.id);
    if (duenos.length) {
      await admin.from("notifications").insert(duenos.map((uid) => ({ user_id: uid, tipo: "recordatorio", mensaje, link: `/jornadas#j-${id}` })));
      await sendPushToUsers(duenos, { title: "🎬 Jornada para cobrar y pagar", body: mensaje, url: `/jornadas#j-${id}`, tag: `jornada-${id}` }).catch(() => undefined);
    }
    revalidar();
    return { ok: true as const };
  });
}

/** Lo que se le cobró al cliente. `null` lo desmarca. */
export async function marcarCobrado(id: string, monto: number | null) {
  return envolver(async () => {
    const me = await soloDueno();
    if (monto != null && !(monto >= 0)) return { error: "El monto no puede ser negativo." };
    const admin = createAdmin();
    const { data: antes } = await admin.from("production_sessions").select("cobrado").eq("id", id).maybeSingle();
    const { error } = await admin
      .from("production_sessions")
      .update(monto == null ? { cobrado: null, cobrado_at: null } : { cobrado: Math.round(monto), cobrado_at: hoyYmd() })
      .eq("id", id);
    if (error) return { error: error.message };
    const previo = antes?.cobrado == null ? null : Number(antes.cobrado);
    await anotar(
      admin,
      id,
      me.id,
      monto == null ? "Desmarcó el cobro" : "Registró un cobro",
      [`Cobrado: ${previo == null ? "—" : fmtARS(previo)} → ${monto == null ? "—" : fmtARS(Math.round(monto))}`]
    );
    revalidar();
    return { ok: true as const };
  });
}

/** Lo que se le pagó a una persona por esta jornada. `null` lo desmarca. */
export async function marcarPagado(id: string, userId: string, monto: number | null) {
  return envolver(async () => {
    const me = await soloDueno();
    if (monto != null && !(monto >= 0)) return { error: "El monto no puede ser negativo." };
    const admin = createAdmin();
    const { data: s } = await admin.from("production_sessions").select("pagos, asistentes").eq("id", id).maybeSingle();
    if (!s) return { error: "No encontré la jornada." };
    if (!((s.asistentes as string[]) ?? []).includes(userId)) return { error: "Esa persona no fue a la jornada." };
    const pagos = { ...((s.pagos as Record<string, { monto: number; fecha: string }>) ?? {}) };
    const previo = pagos[userId]?.monto ?? null;
    if (monto == null) delete pagos[userId];
    else pagos[userId] = { monto: Math.round(monto), fecha: hoyYmd() };
    const { error } = await admin.from("production_sessions").update({ pagos }).eq("id", id);
    if (error) return { error: error.message };
    const quien = (await nombresParaHistorial(admin)).persona(userId);
    await anotar(admin, id, me.id, monto == null ? `Desmarcó el pago a ${quien}` : `Le pagó a ${quien}`, [
      `Pagado a ${quien}: ${previo == null ? "—" : fmtARS(previo)} → ${monto == null ? "—" : fmtARS(Math.round(monto))}`,
    ]);
    revalidar();
    return { ok: true as const };
  });
}

export async function borrarJornada(id: string) {
  return envolver(async () => {
    await soloDueno();
    const admin = createAdmin();
    await admin.from("internal_meetings").delete().eq("production_session_id", id);
    const { error } = await admin.from("production_sessions").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidar();
    return { ok: true as const };
  });
}
