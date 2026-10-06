/**
 * Carga los arranques de 15 días (tickets madre + pasos) y arma el panorama.
 * Lo usan la pantalla de Cuentas nuevas y el aviso diario de cuentas en riesgo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  panoramaDeArranques,
  type ArranqueCrudo,
  type PasoCrudo,
} from "./onboarding-panorama";

export async function cargarPanoramaArranques(admin: SupabaseClient, hoy: string) {
  // Los tickets madre del arranque y, de una, sus pasos.
  const { data: madresRaw } = await admin
    .from("tasks")
    .select("id, numero, titulo, cliente_id, cliente:clients(id, nombre, fecha_inicio)")
    .like("titulo", "Onboarding 15 días — %")
    .is("parent_id", null);

  const madres = ((madresRaw ?? []) as unknown as {
    id: string;
    numero: number | null;
    titulo: string;
    cliente_id: string | null;
    cliente: { id: string; nombre: string; fecha_inicio: string | null } | null;
  }[]).filter((m) => m.cliente);

  let pasos: (PasoCrudo & { parent_id: string })[] = [];
  if (madres.length) {
    const { data: pasosRaw } = await admin
      .from("tasks")
      .select(
        "id, numero, titulo, estado, area, fecha_limite, parent_id, asignado:users!tasks_asignado_a_id_fkey(nombre)"
      )
      .in(
        "parent_id",
        madres.map((m) => m.id)
      );
    pasos = ((pasosRaw ?? []) as unknown as {
      id: string;
      numero: number | null;
      titulo: string;
      estado: string;
      area: string | null;
      fecha_limite: string | null;
      parent_id: string;
      asignado: { nombre: string } | null;
    }[]).map((p) => ({
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      estado: p.estado,
      area: p.area,
      fecha_limite: p.fecha_limite,
      parent_id: p.parent_id,
      asignado_nombre: p.asignado?.nombre ?? null,
    }));
  }

  const crudos: ArranqueCrudo[] = madres.map((m) => ({
    ticketId: m.id,
    numero: m.numero,
    clienteId: m.cliente!.id,
    clienteNombre: m.cliente!.nombre,
    // Si la cuenta no tiene fecha de inicio cargada, el plan se ancla al primer
    // paso; peor sería no mostrar el arranque.
    fechaInicio:
      m.cliente!.fecha_inicio?.slice(0, 10) ??
      pasos
        .filter((p) => p.parent_id === m.id)
        .map((p) => p.fecha_limite?.slice(0, 10) ?? hoy)
        .sort()[0] ??
      hoy,
    pasos: pasos.filter((p) => p.parent_id === m.id),
  }));

  const filas = panoramaDeArranques(crudos, hoy);

  return { filas, madres };
}

/** Lo que necesita el tablero de cuentas nuevas: el progreso por cuenta. Si una
 *  cuenta tiene dos arranques (pasó con un cambio de nombre), manda el que sigue
 *  abierto. */
export function arranquesPorCuenta(filas: Awaited<ReturnType<typeof cargarPanoramaArranques>>["filas"]) {
  const m = new Map<string, { hechos: number; total: number; atrasados: number; terminado: boolean }>();
  for (const f of filas) {
    const ya = m.get(f.clienteId);
    if (ya && !ya.terminado) continue;
    m.set(f.clienteId, { hechos: f.hechos, total: f.total, atrasados: f.atrasados, terminado: f.terminado });
  }
  return m;
}
