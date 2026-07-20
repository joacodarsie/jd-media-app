import { NextRequest, NextResponse } from "next/server";
import { runAutoPublish } from "@/lib/social/auto-publish";

export const dynamic = "force-dynamic";
// Publicar videos implica esperar el procesamiento de Meta: puede tardar.
export const maxDuration = 300;

/**
 * Dispara la auto-publicación de contenidos vencidos.
 * - Vercel Cron diario (red de seguridad).
 * - Scheduler externo cada 10-15 min para horario fino (mismo secret).
 * Autorización: `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret`.
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
  const summary = await runAutoPublish();
  return NextResponse.json(summary);
}
