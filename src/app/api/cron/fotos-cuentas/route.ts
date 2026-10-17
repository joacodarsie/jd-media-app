import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { sacarFotosCuentas } from "@/lib/crecimiento/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Fotos del Instagram de cada cuenta, para el antes y el después (17/10/2026).
 * Corre todos los días: saca la foto de inicio de las cuentas nuevas y una por
 * mes de cada cuenta. Un admin logueado puede dispararlo a mano
 * (?cliente=ID para una sola, ?limite=N para más por corrida).
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
  const sp = req.nextUrl.searchParams;
  const limite = Math.min(10, Math.max(1, Number(sp.get("limite")) || 4));
  const r = await sacarFotosCuentas(createAdmin(), { limite, clienteId: sp.get("cliente") ?? undefined });
  return NextResponse.json(r);
}
