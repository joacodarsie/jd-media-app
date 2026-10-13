import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { fetchIgMediaRange, metaConfigured } from "@/lib/meta/instagram";
import { elegirTrabajos, type CuentaConPiezas } from "@/lib/web/trabajos";
import { corsHeaders } from "@/lib/web/cors";

export const dynamic = "force-dynamic";

/**
 * Lo último que publicamos en el Instagram de las cuentas que se muestran en la
 * web (`clients.mostrar_en_web`). Pública: la consume jdmedia.com.ar. Se cachea
 * 6 horas: Instagram no se consulta en cada visita.
 */
const cargar = unstable_cache(
  async () => {
    if (!metaConfigured()) return [];
    const { data } = await createAdmin()
      .from("clients")
      .select("nombre, ig_user_id, ig_username, fecha_inicio")
      .eq("estado", "activo")
      .eq("mostrar_en_web", true)
      .not("ig_user_id", "is", null);
    const cuentas = (data ?? []) as {
      nombre: string;
      ig_user_id: string;
      ig_username: string | null;
      fecha_inicio: string | null;
    }[];
    const hasta = Math.floor(Date.now() / 1000);
    const desde = hasta - 120 * 86_400;
    const conPiezas: CuentaConPiezas[] = await Promise.all(
      cuentas.map(async (c) => ({
        nombre: c.nombre,
        usuario: c.ig_username,
        desde: c.fecha_inicio,
        piezas: await fetchIgMediaRange(c.ig_user_id, desde, hasta).catch(() => []),
      }))
    );
    return elegirTrabajos(conPiezas);
  },
  ["web-trabajos-v1"],
  { revalidate: 21_600 }
);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const trabajos = await cargar().catch(() => []);
  return NextResponse.json(
    { trabajos },
    {
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
      },
    }
  );
}
