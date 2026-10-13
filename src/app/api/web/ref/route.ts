import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { PCT_RECOMENDADO } from "@/lib/referidos/referidos";

export const dynamic = "force-dynamic";

/**
 * Quién recomendó, para el cartel de la web (programa de referidos, 13/10/2026):
 * jdmedia.com.ar/?ref=CODIGO → «Te recomendó Nazar Hogar: 10% en tu primer
 * mes». Solo el nombre de la marca, que ya es público en el carrusel. Pública.
 */
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const code = (new URL(req.url).searchParams.get("c") ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  if (!code) return NextResponse.json({ ok: false }, { status: 404, headers });
  const { data } = await createAdmin()
    .from("clients")
    .select("nombre")
    .eq("ref_code", code)
    .eq("estado", "activo")
    .maybeSingle();
  const nombre = (data as { nombre: string } | null)?.nombre;
  if (!nombre) return NextResponse.json({ ok: false }, { status: 404, headers });
  return NextResponse.json({ ok: true, nombre, descuento: PCT_RECOMENDADO }, { headers });
}
