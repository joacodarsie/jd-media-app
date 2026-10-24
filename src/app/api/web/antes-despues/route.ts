import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/web/cors";
import { achicarImagenes } from "@/lib/web/imagenes";
import { cargarCasos } from "@/lib/web/casos-run";

export const dynamic = "force-dynamic";

/**
 * El antes y el después de las cuentas para jdmedia.com.ar (17/10/2026). Sale
 * de las fotos automáticas del Instagram (lib/crecimiento). Solo cuentas con
 * `mostrar_en_web` y que mejoraron de verdad; en la web va solo lo que mejoró.
 */
const cargar = cargarCasos;

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const casos = achicarImagenes(await cargar().catch(() => []), 480);
  return NextResponse.json(
    { casos },
    { headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } }
  );
}
