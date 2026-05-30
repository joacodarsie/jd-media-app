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

/**
 * Genera un recordatorio diario de finanzas para admins / usuarios con la
 * feature `finanzas`: avisa de cobros a clientes y pagos al equipo que están
 * atrasados o vencen esta semana. Un solo aviso resumido por persona por día
 * (no spamea aunque el cron corra varias veces). Corre en el cron diario.
 */
export async function ensureFinanceNotifications(admin: SupabaseClient) {
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const in7 = formatInTimeZone(
    new Date(Date.now() + 7 * 86400000),
    TIMEZONE,
    "yyyy-MM-dd"
  );
  const inicioHoyCordoba = toZonedTime(new Date(hoy + "T00:00:00"), TIMEZONE);

  // Destinatarios: admins + cualquiera con la feature `finanzas` otorgada.
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, permisos")
    .eq("activo", true);
  type URow = { id: string; rol: string; permisos: Record<string, boolean> | null };
  const recipients = ((usersRaw ?? []) as URow[])
    .filter((u) => u.rol === "admin" || u.permisos?.finanzas === true)
    .map((u) => u.id);
  if (recipients.length === 0) return;

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    admin
      .from("client_invoices")
      .select("fecha_vencimiento")
      .is("fecha_cobro", null)
      .not("fecha_vencimiento", "is", null),
    admin
      .from("team_payments")
      .select("fecha_programada")
      .is("fecha_pago", null),
  ]);

  const inv = (invoices ?? []) as { fecha_vencimiento: string }[];
  const pay = (payments ?? []) as { fecha_programada: string }[];

  const cobVenc = inv.filter((i) => i.fecha_vencimiento < hoy).length;
  const cobSemana = inv.filter(
    (i) => i.fecha_vencimiento >= hoy && i.fecha_vencimiento <= in7
  ).length;
  const pagVenc = pay.filter((p) => p.fecha_programada < hoy).length;
  const pagSemana = pay.filter(
    (p) => p.fecha_programada >= hoy && p.fecha_programada <= in7
  ).length;

  if (cobVenc + cobSemana + pagVenc + pagSemana === 0) return;

  const parts: string[] = [];
  if (cobVenc) parts.push(`${cobVenc} cobro${cobVenc > 1 ? "s" : ""} atrasado${cobVenc > 1 ? "s" : ""}`);
  if (cobSemana) parts.push(`${cobSemana} cobro${cobSemana > 1 ? "s" : ""} esta semana`);
  if (pagVenc) parts.push(`${pagVenc} pago${pagVenc > 1 ? "s" : ""} al equipo atrasado${pagVenc > 1 ? "s" : ""}`);
  if (pagSemana) parts.push(`${pagSemana} pago${pagSemana > 1 ? "s" : ""} al equipo esta semana`);
  const mensaje = `💰 Finanzas: ${parts.join(" · ")}.`;

  // Un aviso por persona por día (dedup por tipo+link+fecha).
  for (const uid of recipients) {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", uid)
      .eq("tipo", "recordatorio")
      .eq("link", "/finanzas")
      .gte("created_at", inicioHoyCordoba.toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;
    await admin.from("notifications").insert({
      user_id: uid,
      tipo: "recordatorio",
      mensaje,
      link: "/finanzas",
      task_id: null,
    });
  }
}
