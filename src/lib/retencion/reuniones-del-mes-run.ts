/**
 * Las reuniones mensuales abiertas, cuenta por cuenta, con en qué está cada una
 * (ver invitar-reunion.ts). Las lee Mi día: quien tiene el ticket ve las suyas;
 * dirección, todas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoReunion, ESTADO_REUNION, type EstadoReunion } from "./invitar-reunion";
import { etiquetaTurno } from "./reunion-autoagenda";

export interface FilaReunion {
  clienteId: string;
  cuenta: string;
  ticketId: string;
  responsable: string | null;
  estado: EstadoReunion;
  /** «jueves 23/10 a las 15 h», si está agendada. */
  agendada: string | null;
  invitadaEl: string | null;
  /** Fecha de la última reunión registrada, o null si nunca tuvo. */
  ultima: string | null;
  /** Contestó la encuesta de este mes (para pedirla después de la reunión). */
  encuesta: boolean;
}

const PREFIJO = "Reunión mensual";
export const CAMPO_INVITACION = "invitacion";

/** El mes siguiente a 'YYYY-MM'. */
function mesSiguiente(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export async function cargarReunionesDelMes(
  admin: SupabaseClient,
  opts: { hoy: string; userId?: string | null }
): Promise<FilaReunion[]> {
  const periodo = opts.hoy.slice(0, 7);
  let q = admin
    .from("tasks")
    .select("id, cliente_id, asignado_a_id, estado, cliente:clients(nombre, estado)")
    .like("titulo", `${PREFIJO} — %— ${periodo}`)
    .not("estado", "eq", "archivada");
  if (opts.userId) q = q.eq("asignado_a_id", opts.userId);
  const { data: tRaw } = await q;
  const tickets = ((tRaw ?? []) as unknown as {
    id: string;
    cliente_id: string | null;
    asignado_a_id: string | null;
    estado: string;
    cliente: { nombre: string; estado: string } | null;
  }[]).filter((t) => t.cliente_id && t.cliente?.estado === "activo");
  if (!tickets.length) return [];

  const ids = tickets.map((t) => t.cliente_id as string);
  const ticketIds = tickets.map((t) => t.id);
  const ahora = new Date().toISOString();
  const [{ data: mRaw }, { data: imRaw }, { data: hRaw }, { data: uRaw }] = await Promise.all([
    admin.from("client_meetings").select("cliente_id, periodo, fecha").in("cliente_id", ids),
    admin.from("internal_meetings").select("client_id, starts_at").in("client_id", ids).gte("starts_at", ahora).order("starts_at"),
    admin.from("task_history").select("task_id, created_at").eq("campo", CAMPO_INVITACION).in("task_id", ticketIds).order("created_at", { ascending: false }),
    admin.from("users").select("id, nombre"),
  ]);
  const { data: encRaw } = await admin.from("client_satisfaction").select("cliente_id").in("cliente_id", ids).eq("periodo", periodo);
  const conEncuesta = new Set(((encRaw ?? []) as { cliente_id: string }[]).map((e) => e.cliente_id));
  const reuniones = (mRaw ?? []) as { cliente_id: string; periodo: string; fecha: string }[];
  const proximas = (imRaw ?? []) as { client_id: string; starts_at: string }[];
  const invitaciones = (hRaw ?? []) as { task_id: string; created_at: string }[];
  const nombre = new Map(((uRaw ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  // La reunión de cierre de un mes se da del 1 al 10 del siguiente: también cuenta.
  const siguiente = mesSiguiente(periodo);

  const filas = tickets.map((t): FilaReunion => {
    const suyas = reuniones.filter((r) => r.cliente_id === t.cliente_id);
    const hecha =
      t.estado === "completada" ||
      suyas.some((r) => r.periodo === periodo || (r.periodo === siguiente && +r.fecha.slice(8, 10) <= 10));
    const prox = proximas.find((p) => p.client_id === t.cliente_id) ?? null;
    const agendada = prox
      ? etiquetaTurno({
          dia: new Date(Date.parse(prox.starts_at) - 3 * 3_600_000).toISOString().slice(0, 10),
          hora: new Date(Date.parse(prox.starts_at) - 3 * 3_600_000).getUTCHours(),
        })
      : null;
    const invitadaEl = invitaciones.find((i) => i.task_id === t.id)?.created_at ?? null;
    return {
      clienteId: t.cliente_id as string,
      cuenta: t.cliente?.nombre ?? "",
      ticketId: t.id,
      responsable: t.asignado_a_id ? nombre.get(t.asignado_a_id) ?? null : null,
      estado: estadoReunion({ hecha, agendada, invitadaEl }),
      agendada,
      invitadaEl,
      ultima: suyas.map((r) => r.fecha).sort().pop() ?? null,
      encuesta: conEncuesta.has(t.cliente_id as string),
    };
  });
  return filas.sort(
    (a, b) => ESTADO_REUNION[a.estado].orden - ESTADO_REUNION[b.estado].orden || a.cuenta.localeCompare(b.cuenta)
  );
}
