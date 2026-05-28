import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { ensureDueNotifications } from "@/lib/notifications";
import {
  runMonthEndCompliance,
  runMonthStartReports,
} from "@/lib/director/monthly";

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

  return NextResponse.json({
    ok: true,
    users: ids.length,
    processed_ok: ok,
    processed_failed: failed,
    tasks_archived: archivedRows?.length ?? 0,
    month_end: monthEnd,
    month_start: monthStart,
  });
}
