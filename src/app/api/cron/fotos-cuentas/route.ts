import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { sacarFotosCuentas } from "@/lib/crecimiento/run";
import { medirPiezas } from "@/lib/medicion/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Fotos del Instagram de cada cuenta, para el antes y el después (17/10/2026).
 * Corre todos los días: saca la foto de inicio de las cuentas nuevas y una por
 * mes de cada cuenta, y mide las publicaciones que tienen objetivo. Un admin logueado puede dispararlo a mano
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
  const admin = createAdmin();
  const r = await sacarFotosCuentas(admin, { limite, clienteId: sp.get("cliente") ?? undefined });
  // Y de paso, el resultado de cada publicación con objetivo (17/10/2026).
  const medicion = await medirPiezas(admin, { clienteId: sp.get("cliente") ?? undefined }).catch((e) => ({ error: String(e) }));
  return NextResponse.json({ ...r, medicion });
}
