import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/push";
import { avisosDeHoy, diaAr, type ReunionDelDia } from "@/lib/prospecting/reunion";

/**
 * El recordatorio de la mañana: a cada persona, sus reuniones de hoy de la
 * Agenda en un solo aviso (plataforma + celular). Nació con las reuniones con
 * prospectos (24/9), pero sirve para cualquier reunión de la Agenda.
 *
 * Idempotente: si el cron corre dos veces el mismo día, no repite el aviso.
 */
export async function runRecordatorioReunionesHoy(admin: SupabaseClient, ahora = new Date()) {
  const hoy = diaAr(ahora);
  // Ventana amplia (hoy ± 1 día en UTC) y el filtro fino por día de Argentina.
  const desde = new Date(ahora.getTime() - 24 * 3600_000).toISOString();
  const hasta = new Date(ahora.getTime() + 48 * 3600_000).toISOString();

  const { data: meetings, error } = await admin
    .from("internal_meetings")
    .select("id, titulo, starts_at, internal_meeting_attendees(user_id)")
    .gte("starts_at", desde)
    .lt("starts_at", hasta);
  if (error) return { error: error.message };

  const reuniones: ReunionDelDia[] = (
    (meetings ?? []) as {
      titulo: string;
      starts_at: string;
      internal_meeting_attendees: { user_id: string }[] | null;
    }[]
  ).map((m) => ({
    titulo: m.titulo,
    starts_at: m.starts_at,
    asistentes: (m.internal_meeting_attendees ?? []).map((a) => a.user_id),
  }));

  const avisos = avisosDeHoy(reuniones, hoy);
  if (avisos.size === 0) return { hoy, avisados: 0 };

  // No repetir: los que ya recibieron hoy este mismo aviso.
  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const { data: ya } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .in("user_id", [...avisos.keys()])
    .gte("created_at", inicioDia)
    .like("mensaje", "Hoy tenés%");
  const yaAvisado = new Set(((ya ?? []) as { user_id: string; mensaje: string }[]).map((n) => `${n.user_id}|${n.mensaje}`));

  const nuevos = [...avisos].filter(([u, m]) => !yaAvisado.has(`${u}|${m}`));
  if (nuevos.length === 0) return { hoy, avisados: 0 };

  await admin.from("notifications").insert(
    nuevos.map(([user_id, mensaje]) => ({ user_id, task_id: null, tipo: "recordatorio", mensaje, link: "/agenda" }))
  );
  for (const [user_id, mensaje] of nuevos) {
    await sendPushToUsers([user_id], { title: "Reuniones de hoy", body: mensaje, url: "/agenda", tag: `reuniones-${hoy}` });
  }
  return { hoy, avisados: nuevos.length };
}
