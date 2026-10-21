import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { equipoParaWeb } from "@/lib/web/equipo";

export const dynamic = "force-dynamic";

/**
 * El equipo para la sección «Nosotros» de jdmedia.com.ar (21/10/2026). Pública:
 * solo nombre, rol, qué hace y la foto de Mi perfil. Cuando alguien cambia su
 * foto se invalida el tag «web-equipo» y la web la muestra enseguida.
 */
const cargar = unstable_cache(
  async () => {
    const { data } = await createAdmin()
      .from("users")
      .select("nombre, area, area_secundaria, avatar_url, email")
      .eq("activo", true);
    return equipoParaWeb(
      (data ?? []) as { nombre: string; area: string | null; area_secundaria: string | null; avatar_url: string | null; email: string | null }[]
    );
  },
  ["web-equipo-v1"],
  { revalidate: 3_600, tags: ["web-equipo"] }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const equipo = await cargar().catch(() => []);
  return NextResponse.json(
    { equipo },
    { headers: { ...corsHeaders(req.headers.get("origin")), "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
