import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { runDirectorWeekly } from "@/lib/director/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Director Creativo IA — cron semanal (viernes). La lógica vive en
 * lib/director/run.ts para reutilizarla desde el botón de trigger manual.
 *
 * Auth: header Authorization: Bearer <CRON_SECRET>
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdmin();
  const res = await runDirectorWeekly(admin, new Date(), true);
  return NextResponse.json(res);
}
