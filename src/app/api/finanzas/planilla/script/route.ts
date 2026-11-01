import { NextRequest, NextResponse } from "next/server";
import { PLANILLA_GS } from "@/lib/finanzas/planilla-gs";
import { planillaAutorizada } from "@/lib/finanzas/planilla-auth";

export const dynamic = "force-dynamic";

/**
 * El código de la planilla "Finanzas de Joaquín".
 *
 * En la planilla vive solo un cargador (scripts/planilla-cargador.gs) que baja
 * esto cada diez minutos. El dueño lo pidió así: no quiere pegar código a mano
 * cada vez que algo cambia. Ahora un cambio acá llega a su planilla con el
 * próximo deploy, sin que toque nada.
 */
export async function GET(req: NextRequest) {
  const ok = await planillaAutorizada(req);
  if (ok === null) return NextResponse.json({ error: "Falta la clave de la planilla (0227)" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  return new NextResponse(PLANILLA_GS, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}
