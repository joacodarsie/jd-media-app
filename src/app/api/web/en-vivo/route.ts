import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { usuarioDe } from "@/lib/diagnostico/puntaje";
import { perfilPublico } from "@/lib/diagnostico/instagram-publico";
import { resumirEnVivo } from "@/lib/web/vitrina";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * «En vivo desde la agencia» para jdmedia.com.ar (17/10/2026): cuántas
 * publicaciones salieron esta semana en las cuentas que acompañamos y cuál fue
 * la última. Sale de Instagram (no del calendario), cacheado 3 horas.
 */
const cargar = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data: base } = await admin.from("clients").select("ig_user_id").not("ig_user_id", "is", null).ilike("nombre", "jd media").limit(1).maybeSingle();
    const desde = (base as { ig_user_id: string } | null)?.ig_user_id;
    if (!desde) return null;
    const { data } = await admin
      .from("clients")
      .select("nombre, instagram_url")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .eq("mostrar_en_web", true)
      .not("instagram_url", "is", null);
    const cuentas = await Promise.all(
      ((data ?? []) as { nombre: string; instagram_url: string }[]).map(async (c) => {
        const u = usuarioDe(c.instagram_url);
        if (!u) return { marca: c.nombre, fechas: [] as string[] };
        const p = await perfilPublico(desde, u).catch(() => null);
        return { marca: c.nombre, fechas: (p?.posts ?? []).map((x) => x.timestamp) };
      })
    );
    return resumirEnVivo(cuentas);
  },
  ["web-en-vivo-v1"],
  { revalidate: 10_800 }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const r = await cargar().catch(() => null);
  return NextResponse.json(r ? { ok: true, ...r } : { ok: false }, {
    headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=10800" },
  });
}
