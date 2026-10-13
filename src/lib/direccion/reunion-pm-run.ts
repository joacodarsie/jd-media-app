/**
 * Agenda sola la reunión semanal del dueño con la PM (13/10/2026). La corre el
 * cron diario junto con las rutinas: si la del martes ya está en la Agenda (o
 * alguien la movió dentro de ese mismo día), no hace nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { TITULO_REUNION_PM, reunionSemanalPm } from "./rutina";

export async function agendarReunionPm(
  admin: SupabaseClient,
  hoy: string,
  duenoId: string | null,
  pmId: string | null
): Promise<"creada" | "ya_estaba" | "sin_gente"> {
  if (!duenoId || !pmId || duenoId === pmId) return "sin_gente";
  const r = reunionSemanalPm(hoy);

  // Si la movieron de horario, sigue siendo la de esa semana: se busca por
  // título en toda la semana del martes.
  const desde = new Date(`${r.fecha}T00:00:00-03:00`);
  desde.setUTCDate(desde.getUTCDate() - 1);
  const hasta = new Date(desde);
  hasta.setUTCDate(hasta.getUTCDate() + 7);
  const { data: ya } = await admin
    .from("internal_meetings")
    .select("id")
    .eq("titulo", TITULO_REUNION_PM)
    .gte("starts_at", desde.toISOString())
    .lt("starts_at", hasta.toISOString())
    .limit(1);
  if (ya && ya.length > 0) return "ya_estaba";

  const { data: m, error } = await admin
    .from("internal_meetings")
    .insert({
      titulo: TITULO_REUNION_PM,
      descripcion: r.descripcion,
      starts_at: r.startsAt,
      ends_at: r.endsAt,
      created_by: duenoId,
    })
    .select("id")
    .single();
  if (error || !m) throw new Error(error?.message ?? "No se pudo agendar la reunión con la PM");
  await admin.from("internal_meeting_attendees").insert([
    { meeting_id: (m as { id: string }).id, user_id: duenoId },
    { meeting_id: (m as { id: string }).id, user_id: pmId },
  ]);
  return "creada";
}
