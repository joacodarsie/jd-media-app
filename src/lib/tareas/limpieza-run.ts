/**
 * El recordatorio de los lunes de la limpieza de vencidas (24/10/2026): a cada
 * persona con tareas vencidas le llega un aviso que lleva a /tareas/limpieza.
 * Una sola vez por lunes (el cron corre tres veces por día).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mensajeLimpieza, tocaRecordatorio } from "./limpieza";

export async function runLimpiezaSemanal(admin: SupabaseClient, hoy: string): Promise<{ avisados: number }> {
  if (!tocaRecordatorio(hoy)) return { avisados: 0 };
  const [{ data: tareas }, { data: users }, { data: ya }] = await Promise.all([
    admin.from("tasks").select("asignado_a_id").in("estado", ["pendiente", "en_progreso", "en_revision", "bloqueada"]).lt("fecha_limite", hoy).limit(2000),
    admin.from("users").select("id").eq("activo", true),
    admin.from("notifications").select("user_id").eq("link", "/tareas/limpieza").gte("created_at", `${hoy}T00:00:00-03:00`),
  ]);
  const activos = new Set(((users ?? []) as { id: string }[]).map((u) => u.id));
  const avisados = new Set(((ya ?? []) as { user_id: string }[]).map((n) => n.user_id));
  const porPersona = new Map<string, number>();
  for (const t of (tareas ?? []) as { asignado_a_id: string | null }[])
    if (t.asignado_a_id && activos.has(t.asignado_a_id)) porPersona.set(t.asignado_a_id, (porPersona.get(t.asignado_a_id) ?? 0) + 1);
  const filas = [...porPersona.entries()]
    .filter(([id]) => !avisados.has(id))
    .map(([user_id, n]) => ({ user_id, tipo: "recordatorio", mensaje: mensajeLimpieza(n), link: "/tareas/limpieza", task_id: null }));
  if (filas.length) await admin.from("notifications").insert(filas);
  return { avisados: filas.length };
}
