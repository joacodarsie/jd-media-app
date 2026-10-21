/**
 * Cuando una cuenta se va o se pausa, su trabajo pendiente se archiva
 * (21/10/2026). Antes quedaba abierto: Lubricentro se dio de baja el 13/10 y
 * el 21/10 seguían 9 piezas «en progreso» (trabajo que nadie iba a cobrar), y
 * las 22 tareas del arranque de Blasco inflaban las vencidas del equipo.
 * Archivar se puede deshacer; si la cuenta vuelve, el arranque arma lo nuevo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const ESTADOS_SIN_TRABAJO = ["perdido", "en_pausa"] as const;

export function cuentaSinTrabajo(estado: string | null | undefined): boolean {
  return (ESTADOS_SIN_TRABAJO as readonly string[]).includes(estado ?? "");
}

/** Archiva las tareas abiertas de una cuenta. Devuelve cuántas archivó. */
export async function archivarTrabajoDeCuenta(admin: SupabaseClient, clienteId: string): Promise<number> {
  const { data } = await admin
    .from("tasks")
    .update({ estado: "archivada" })
    .eq("cliente_id", clienteId)
    .not("estado", "in", "(completada,archivada)")
    .select("id");
  return (data ?? []).length;
}

/** Red de seguridad del cron: lo que haya quedado abierto en cuentas perdidas o en pausa. */
export async function runArchivarCuentasInactivas(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from("clients").select("id").in("estado", [...ESTADOS_SIN_TRABAJO]);
  let total = 0;
  for (const c of (data ?? []) as { id: string }[]) total += await archivarTrabajoDeCuenta(admin, c.id);
  return total;
}
