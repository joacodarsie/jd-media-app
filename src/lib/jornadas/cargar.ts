/** Lo que habla con la base para el registro de jornadas (ver registro.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JornadaRegistro } from "./registro";

export interface JornadaFila extends JornadaRegistro {
  clienteId: string | null;
  cliente: string | null;
  lugar: string | null;
  notas: string | null;
  /** Tiene su evento en la Agenda. */
  agendada: boolean;
  /** Quién cambió qué y cuándo, lo más nuevo primero (0218). */
  historial: CambioJornada[];
}

export interface CambioJornada {
  cuando: string;
  quien: string;
  accion: string;
  detalle: string[];
}

export function aRegistro(s: Record<string, unknown>, clientes: Map<string, string>, agendadas: Set<string>): JornadaFila {
  const num = (v: unknown) => Number(v ?? 0) || 0;
  return {
    id: String(s.id),
    fecha: String(s.fecha),
    horaInicio: (s.hora_inicio as string | null) ?? null,
    horas: num(s.horas) || 1,
    monto: num(s.monto),
    viaticos: num(s.viaticos),
    viaticosDetalle: (s.viaticos_detalle as Record<string, number> | null) ?? {},
    viaticosLosPaga: s.viaticos_los_paga === "cliente" ? "cliente" : "agencia",
    cobraTodo: s.cobra_todo === true,
    asistentes: (s.asistentes as string[] | null) ?? [],
    cobrado: s.cobrado == null ? null : num(s.cobrado),
    cobradoAt: (s.cobrado_at as string | null) ?? null,
    pagos: (s.pagos as JornadaRegistro["pagos"] | null) ?? {},
    confirmadaAt: (s.confirmada_at as string | null) ?? null,
    clienteId: (s.cliente_id as string | null) ?? null,
    cliente: s.cliente_id ? clientes.get(String(s.cliente_id)) ?? null : null,
    lugar: (s.lugar as string | null) ?? null,
    notas: (s.notas as string | null) ?? null,
    agendada: agendadas.has(String(s.id)),
    historial: [],
  };
}

export async function cargarJornadas(admin: SupabaseClient): Promise<JornadaFila[]> {
  const [{ data: sesiones }, { data: clientes }, { data: eventos }, { data: users }] = await Promise.all([
    admin.from("production_sessions").select("*").order("fecha", { ascending: false }).limit(500),
    admin.from("clients").select("id, nombre"),
    admin.from("internal_meetings").select("production_session_id").not("production_session_id", "is", null),
    admin.from("users").select("id, nombre"),
  ]);
  const porId = new Map(((clientes ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]));
  const agendadas = new Set(((eventos ?? []) as { production_session_id: string }[]).map((e) => e.production_session_id));
  const filas = ((sesiones ?? []) as Record<string, unknown>[]).map((s) => aRegistro(s, porId, agendadas));

  // El historial de cada una (si 0218 no está, queda vacío).
  const nombre = new Map(((users ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre.split(" ")[0]]));
  const porSesion = new Map(filas.map((j) => [j.id, j]));
  const ids = filas.map((j) => j.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from("production_session_cambios")
      .select("session_id, user_id, accion, detalle, created_at")
      .in("session_id", ids.slice(i, i + 200))
      .order("created_at", { ascending: false });
    for (const c of (data ?? []) as { session_id: string; user_id: string | null; accion: string; detalle: string[] | null; created_at: string }[]) {
      porSesion.get(c.session_id)?.historial.push({
        cuando: c.created_at,
        quien: c.user_id ? nombre.get(c.user_id) ?? "alguien" : "la plataforma",
        accion: c.accion,
        detalle: c.detalle ?? [],
      });
    }
  }
  return filas;
}
