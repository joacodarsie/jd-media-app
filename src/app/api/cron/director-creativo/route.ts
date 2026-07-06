import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { runHealthDigest } from "@/lib/director/health-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Director IA — cron quincenal (día 1 y 15). Avisa al owner + digest el estado
 * de salud de las cuentas (semáforo bien/regular/mal) para el seguimiento en
 * /director. El tablero es en vivo; esto solo dispara el recordatorio.
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
  const res = await runHealthDigest(admin, new Date());
  return NextResponse.json(res);
}
