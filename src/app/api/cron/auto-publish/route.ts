import { NextRequest, NextResponse } from "next/server";
import { runAutoPublish } from "@/lib/social/auto-publish";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Publicar videos implica esperar el procesamiento de Meta: puede tardar.
export const maxDuration = 300;

/**
 * Dispara la auto-publicación de contenidos vencidos.
 * - Vercel Cron diario (red de seguridad).
 * - Scheduler externo cada 10-15 min para horario fino (mismo secret).
 * - Un admin logueado también puede dispararlo a mano (abrir la URL).
 * Autorización: `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret`.
 */
function hasSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret");
  if (x === secret) return true;
  return false;
}

async function isAdmin(): Promise<boolean> {
  try {
    const me = await requireUser();
    return me.rol === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!hasSecret(req) && !(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runAutoPublish();
  return NextResponse.json(summary);
}
