import { NextRequest, NextResponse } from "next/server";
import { runColdEmailBatch } from "@/lib/email/cold-sender";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Mandar de a 100 con reintentos puede pasar el minuto.
export const maxDuration = 300;

/**
 * Manda el lote de email en frío del día.
 * - Vercel Cron diario.
 * - Un admin logueado puede abrir la URL para dispararlo a mano.
 * Autorización: `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret`.
 */
function hasSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
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
  return NextResponse.json(await runColdEmailBatch());
}
