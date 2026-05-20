import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "./constants";

/**
 * Genera notificaciones in-app de "vencida" y "próxima a vencer" para las
 * tareas activas asignadas al usuario, evitando duplicados del mismo día.
 * Pensado para correr en el layout: barato y silencioso.
 */
export async function ensureDueNotifications(
  supabase: SupabaseClient,
  userId: string
) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const tomorrowDate = new Date(Date.now() + 86400000);
  const manana = formatInTimeZone(tomorrowDate, TIMEZONE, "yyyy-MM-dd");
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  const { data: misTareas } = await supabase
    .from("tasks")
    .select("id, titulo, fecha_limite")
    .eq("asignado_a_id", userId)
    .neq("estado", "completada")
    .not("fecha_limite", "is", null);

  if (!misTareas || misTareas.length === 0) return;

  const taskIds = misTareas.map((t) => t.id);

  const { data: existentes } = await supabase
    .from("notifications")
    .select("task_id, tipo, created_at")
    .eq("user_id", userId)
    .in("task_id", taskIds)
    .in("tipo", ["vencida", "proxima_a_vencer"])
    .gte("created_at", inicioHoyCordoba.toISOString());

  const yaCreadas = new Set(
    (existentes ?? []).map((n) => `${n.task_id}:${n.tipo}`)
  );

  const nuevas: {
    user_id: string;
    task_id: string;
    tipo: string;
    mensaje: string;
  }[] = [];

  for (const t of misTareas) {
    const limite = (t.fecha_limite as string).slice(0, 10);
    if (limite < hoy) {
      const key = `${t.id}:vencida`;
      if (!yaCreadas.has(key))
        nuevas.push({
          user_id: userId,
          task_id: t.id,
          tipo: "vencida",
          mensaje: `Tarea vencida: "${t.titulo}"`,
        });
    } else if (limite === hoy || limite === manana) {
      const key = `${t.id}:proxima_a_vencer`;
      if (!yaCreadas.has(key))
        nuevas.push({
          user_id: userId,
          task_id: t.id,
          tipo: "proxima_a_vencer",
          mensaje:
            limite === hoy
              ? `Vence hoy: "${t.titulo}"`
              : `Vence mañana: "${t.titulo}"`,
        });
    }
  }

  if (nuevas.length) await supabase.from("notifications").insert(nuevas);
}
