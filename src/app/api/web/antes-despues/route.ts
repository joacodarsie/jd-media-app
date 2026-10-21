import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { achicarImagenes } from "@/lib/web/imagenes";
import { cargarCrecimiento } from "@/lib/crecimiento/cargar";
import { elegirCasos, type CandidatoCaso } from "@/lib/web/vitrina";

export const dynamic = "force-dynamic";

/**
 * El antes y el después de las cuentas para jdmedia.com.ar (17/10/2026). Sale
 * de las fotos automáticas del Instagram (lib/crecimiento). Solo cuentas con
 * `mostrar_en_web` y que mejoraron de verdad; en la web va solo lo que mejoró.
 */
const cargar = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data } = await admin
      .from("clients")
      .select("id, nombre")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .eq("mostrar_en_web", true);
    const candidatos: CandidatoCaso[] = await Promise.all(
      ((data ?? []) as { id: string; nombre: string }[]).map(async (c) => {
        const d = await cargarCrecimiento(admin, c.id);
        return {
          nombre: c.nombre,
          usuario: d.hoy?.usuario ?? d.inicio?.usuario ?? null,
          meses: d.meses,
          antes: d.inicio ? { fecha: d.inicio.fecha, grilla: d.inicio.grilla } : null,
          hoy: d.hoy ? { fecha: d.hoy.fecha, grilla: d.hoy.grilla } : null,
          comparaciones: d.comparaciones,
        };
      })
    );
    return elegirCasos(candidatos);
  },
  ["web-antes-despues-v5"],
  { revalidate: 21_600 }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const casos = achicarImagenes(await cargar().catch(() => []), 360);
  return NextResponse.json(
    { casos },
    { headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } }
  );
}
