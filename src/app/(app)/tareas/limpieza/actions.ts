"use server";

/**
 * Las tres salidas de la limpieza de vencidas (24/10/2026): «Ya está»
 * (completada, con el mismo candado y aprobación que en Tareas), «Pasala al…»
 * (nueva fecha) y «Ya no va» (archivada). Cada uno limpia las suyas; la
 * coordinación y dirección pueden limpiar cualquiera.
 */
import { requireUser, isStaffUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { bulkSetDueDate, updateTaskStatus } from "@/app/(app)/tareas/actions";

export async function limpiarTarea(id: string, accion: "hecha" | "pasar" | "no_va", fecha?: string) {
  const me = await requireUser();
  const { data } = await createAdmin().from("tasks").select("asignado_a_id").eq("id", id).maybeSingle();
  const t = data as { asignado_a_id: string | null } | null;
  if (!t) return { error: "No encontré la tarea." };
  if (t.asignado_a_id !== me.id && !isStaffUser(me)) return { error: "Es de otra persona." };
  if (accion === "pasar") {
    if (!fecha) return { error: "Elegí la fecha." };
    const r = await bulkSetDueDate([id], fecha);
    return "error" in r && r.error ? { error: r.error } : { ok: true as const };
  }
  const r = await updateTaskStatus(id, accion === "hecha" ? "completada" : "archivada");
  if ("error" in r && r.error) return { error: r.error };
  return { ok: true as const, aviso: (r as { aviso?: string }).aviso };
}
