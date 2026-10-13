import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { marcasParaWeb } from "@/lib/web/marcas";
import { corsHeaders } from "@/lib/web/cors";

export const dynamic = "force-dynamic";

/** Los clientes activos para el carrusel de marcas de jdmedia.com.ar. Pública. */
const cargar = unstable_cache(
  async () => {
    const { data } = await createAdmin()
      .from("clients")
      .select("nombre, logo_url, ig_username, instagram_url, fecha_inicio")
      .eq("estado", "activo")
      .eq("es_interno", false);
    return marcasParaWeb(
      (data ?? []) as {
        nombre: string;
        logo_url: string | null;
        ig_username: string | null;
        instagram_url: string | null;
        fecha_inicio: string | null;
      }[]
    );
  },
  ["web-marcas-v1"],
  { revalidate: 3_600, tags: ["web-marcas"] }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const marcas = await cargar().catch(() => []);
  return NextResponse.json(
    { marcas },
    {
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    }
  );
}
