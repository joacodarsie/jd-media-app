import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  ensureDueNotifications,
  ensureFinanceNotifications,
  ensureCobroReminders,
} from "@/lib/notifications";
import {
  runMonthEndCompliance,
  runMonthStartReports,
} from "@/lib/director/monthly";
import { runPaidMediaDaily } from "@/lib/paid-media/sync";
import { runInstagramDaily } from "@/lib/social/sync";
import { runAccountAlerts } from "@/lib/social/alerts";
import { checkMetaToken } from "@/lib/meta/health";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron que recorre todos los usuarios activos y genera las notificaciones
 * "vencida" / "proxima a vencer" del dia. Antes esto corria en el layout
 * en CADA navegacion (lentisimo). Ahora corre 3 veces por dia:
 *   - 09:00 ART (12 UTC): manana laboral
 *   - 13:00 ART (16 UTC): post-almuerzo
 *   - 17:00 ART (20 UTC): cierre del dia
 *
 * Autorizacion: Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret");
  if (x === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdmin();
  const { data: users, error } = await admin
    .from("users")
    .select("id")
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = ((users ?? []) as { id: string }[]).map((u) => u.id);
  let ok = 0;
  let failed = 0;
  // Recorrer secuencial para no saturar — son pocas decenas de users.
  for (const uid of ids) {
    try {
      await ensureDueNotifications(admin, uid);
      ok++;
    } catch {
      failed++;
    }
  }

  // Recordatorio de finanzas (cobros/pagos venciendo o atrasados) para admins
  // y usuarios con la feature finanzas. Un aviso resumido por día.
  let financeNotified = false;
  try {
    await ensureFinanceNotifications(admin);
    financeNotified = true;
  } catch {
    financeNotified = false;
  }

  // Auto-archive: tareas completadas hace más de 30 días.
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: archivedRows } = await admin
    .from("tasks")
    .update({ estado: "archivada" })
    .eq("estado", "completada")
    .lt("fecha_completada", cutoff)
    .select("id");

  // Director Creativo — chequeos de fecha (van acá para no sumar crons en Hobby).
  // Envueltos en try/catch para que un fallo nunca corte las notificaciones.
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const esUltimoDiaDeMes = tomorrow.getMonth() !== now.getMonth();
  const esPrimerDiaDeMes = now.getDate() === 1;

  let monthEnd: unknown = null;
  let monthStart: unknown = null;
  if (esUltimoDiaDeMes) {
    try {
      monthEnd = await runMonthEndCompliance(admin, now);
    } catch (e) {
      monthEnd = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (esPrimerDiaDeMes) {
    try {
      monthStart = await runMonthStartReports(admin, now);
    } catch (e) {
      monthStart = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Recordatorio mensual de cobro a clientes (arranca el mes). Dedup por mes,
  // así que es seguro intentarlo en cada corrida del 1°.
  let cobroReminders: unknown = null;
  if (esPrimerDiaDeMes) {
    try {
      await ensureCobroReminders(admin);
      cobroReminders = { ok: true };
    } catch (e) {
      cobroReminders = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Paid media: snapshot diario + análisis IA de cada cuenta con Meta cargado.
  // Va acá (no en un cron propio) para no sumar crons en Hobby.
  let paidMedia: unknown = null;
  try {
    paidMedia = await runPaidMediaDaily();
  } catch (e) {
    paidMedia = { error: e instanceof Error ? e.message : String(e) };
  }

  // Instagram: snapshot diario de seguidores/alcance de cada cliente conectado.
  let instagram: unknown = null;
  try {
    instagram = await runInstagramDaily();
  } catch (e) {
    instagram = { error: e instanceof Error ? e.message : String(e) };
  }

  // Salud del token de Meta (punto único de falla de Paid Media + Resultados).
  // Si está caído o vence pronto, avisamos a los admins (deduplicado 20h).
  let metaToken: unknown = null;
  try {
    const status = await checkMetaToken();
    metaToken = status;
    const problema =
      status.configured &&
      (!status.ok || (status.daysToExpiry != null && status.daysToExpiry <= 7));
    if (problema) {
      const msg = !status.ok
        ? `⚠️ Meta: el token dejó de funcionar (${status.error ?? "error"}). Regeneralo, si no Paid Media y Resultados no traen datos.`
        : `⚠️ Meta: el token vence en ${status.daysToExpiry} días. Conviene regenerarlo pronto.`;
      const { data: adminsRaw } = await admin
        .from("users")
        .select("id")
        .eq("activo", true)
        .eq("rol", "admin");
      const adminIds = ((adminsRaw ?? []) as { id: string }[]).map((a) => a.id);
      if (adminIds.length > 0) {
        const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
        const { data: existing } = await admin
          .from("notifications")
          .select("user_id")
          .like("mensaje", "⚠️ Meta:%")
          .gte("created_at", since);
        const already = new Set(
          ((existing ?? []) as { user_id: string }[]).map((n) => n.user_id)
        );
        const rows = adminIds
          .filter((id) => !already.has(id))
          .map((id) => ({
            user_id: id,
            tipo: "recordatorio" as const,
            mensaje: msg,
            leida: false,
            link: "/paid-media",
          }));
        if (rows.length > 0) await admin.from("notifications").insert(rows);
      }
    }
  } catch (e) {
    metaToken = { error: e instanceof Error ? e.message : String(e) };
  }

  // Alertas de cuentas: IG perdiendo seguidores, pauta sin conversiones.
  // Va después de los syncs (usa los snapshots recién guardados).
  let accountAlerts: unknown = null;
  try {
    accountAlerts = await runAccountAlerts(admin);
  } catch (e) {
    accountAlerts = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    ok: true,
    users: ids.length,
    processed_ok: ok,
    processed_failed: failed,
    finance_notified: financeNotified,
    tasks_archived: archivedRows?.length ?? 0,
    month_end: monthEnd,
    month_start: monthStart,
    cobro_reminders: cobroReminders,
    paid_media: paidMedia,
    instagram,
    meta_token: metaToken,
    account_alerts: accountAlerts,
  });
}
