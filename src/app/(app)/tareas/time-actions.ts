"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

async function ctx() {
  const me = await requireUser();
  const supabase = createClient();
  return { supabase, userId: me.id };
}

/** Arranca un timer en la tarea. Si tenía otro abierto, lo cierra primero. */
export async function startTimer(taskId: string) {
  const { supabase, userId } = await ctx();
  // Cerrar timers abiertos del user
  await supabase
    .from("task_time_entries")
    .update({ stopped_at: new Date().toISOString() })
    .is("stopped_at", null)
    .eq("user_id", userId);

  const { error } = await supabase
    .from("task_time_entries")
    .insert({ task_id: taskId, user_id: userId });
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function stopTimer(taskId: string) {
  const { supabase, userId } = await ctx();
  const { error } = await supabase
    .from("task_time_entries")
    .update({ stopped_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .is("stopped_at", null);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteEntry(entryId: string, taskId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("task_time_entries").delete().eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}

/** Agregar una entrada manual (cuando olvidaste el timer). */
export async function logManualEntry(
  taskId: string,
  minutes: number,
  notas?: string
) {
  const { supabase, userId } = await ctx();
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
    return { error: "Minutos inválidos (1 a 1440)" };
  }
  const now = new Date();
  const start = new Date(now.getTime() - minutes * 60_000);
  const { error } = await supabase.from("task_time_entries").insert({
    task_id: taskId,
    user_id: userId,
    started_at: start.toISOString(),
    stopped_at: now.toISOString(),
    notas: notas?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}
