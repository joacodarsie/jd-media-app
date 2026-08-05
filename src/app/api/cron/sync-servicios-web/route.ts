import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sincronizarServiciosConLaWeb } from "@/lib/agency/aplicar-sync";

export const dynamic = "force-dynamic";
// Son 7 requests a la web (home + una por servicio): sobra, pero no queremos
// que un sitio lento corte la corrida.
export const maxDuration = 120;

/**
 * Sincroniza el catálogo de servicios con jdmedia.com.ar.
 *
 * - GitHub Actions una vez por día (mismo CRON_SECRET que el publicador).
 * - Un admin logueado puede abrir la URL para dispararlo a mano.
 *
 * Nunca borra servicios: ver la nota en lib/agency/sync-web-servicios.ts.
 */
function hasSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
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

  const origen = hasSecret(req) ? "cron" : "manual";
  const r = await sincronizarServiciosConLaWeb(origen);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
