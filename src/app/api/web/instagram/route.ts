import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { fetchIgMediaRange, fetchIgProfile } from "@/lib/meta/instagram";
import { armarHistoria } from "@/lib/web/historia-ig";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El Instagram de JD Media para «Nosotros» en jdmedia.com.ar (23/10/2026):
 * los primeros posteos, lo que más se vio, lo último y la curva de seguidores.
 * Pública (es la cuenta pública de la agencia). Se arma cada 6 horas: las
 * imágenes del CDN de Meta vencen a los pocos días.
 */
const cargar = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data: c } = await admin.from("clients").select("id, ig_user_id").eq("es_interno", true).limit(1).maybeSingle();
    const cuenta = c as { id: string; ig_user_id: string | null } | null;
    if (!cuenta?.ig_user_id) return null;
    const [perfil, media, { data: fotos }] = await Promise.all([
      fetchIgProfile(cuenta.ig_user_id),
      fetchIgMediaRange(cuenta.ig_user_id, 1_704_067_200, Math.floor(Date.now() / 1000), 20),
      admin.from("ig_snapshots").select("fecha, followers").eq("cliente_id", cuenta.id).order("fecha").limit(1000),
    ]);
    return armarHistoria(
      { usuario: perfil.username ?? "jdmedia.digital", seguidores: perfil.followers, publicaciones: perfil.media_count },
      media,
      ((fotos ?? []) as { fecha: string; followers: number | null }[]).map((f) => ({ fecha: f.fecha, seguidores: f.followers ?? 0 }))
    );
  },
  ["web-instagram-v2"],
  { revalidate: 21_600, tags: ["web-instagram"] }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const historia = await cargar().catch(() => null);
  return NextResponse.json(
    { historia },
    { headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } }
  );
}
