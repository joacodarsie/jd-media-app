import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { generarInforme, periodoPorDefecto } from "@/lib/finanzas/informe-run";
import { nombreArchivo } from "@/lib/finanzas/informe-mensual";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El informe mensual de finanzas, en Excel.
 *
 * El dueño pidió esto porque la sección de Finanzas lo marea y le cuesta
 * confiar en los números: un documento lo puede mandar al contador sin dar
 * acceso, abrirlo sin loguearse, y —lo más importante— lo obliga a mirar los
 * números una vez por mes.
 *
 * Sale del mismo lugar que /finanzas/resumen y con el mismo conversor de
 * moneda, así que las dos cosas dicen lo mismo. La hoja 1 trae los controles
 * cruzados que lo demuestran.
 */
export async function GET(req: NextRequest) {
  await requireFeature("finanzas");

  const m = req.nextUrl.searchParams.get("m");
  const periodo = m && /^\d{4}-\d{2}$/.test(m) ? m : periodoPorDefecto();

  try {
    const { buffer } = await generarInforme(createAdmin(), periodo);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombreArchivo(periodo))}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo armar el informe" },
      { status: 500 }
    );
  }
}
