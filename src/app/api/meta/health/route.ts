import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { checkMetaToken } from "@/lib/meta/health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Salud del token de Meta a demanda (solo admin): validez, permisos,
 * expiración y qué scopes faltan según lo que la app necesita.
 *
 * Con `?igtest=1` corre además un TEST SECO de publicación: crea un
 * container de imagen en el IG de JD Media pero NO lo publica (los
 * containers sin publicar expiran solos a las 24h y no se ven en ningún
 * lado). Valida token + cuenta IG + que Meta pueda leer el bucket público.
 */
export async function GET(req: NextRequest) {
  const me = await requireUser();
  if (me.rol !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }
  const status = await checkMetaToken();

  const { searchParams } = new URL(req.url);
  if (searchParams.get("igtest") !== "1") {
    return NextResponse.json(status);
  }

  // ── Test seco ──
  const admin = createAdmin();
  let { data: client } = await admin
    .from("clients")
    .select("id, nombre, ig_user_id")
    .ilike("nombre", "%jd media%")
    .not("ig_user_id", "is", null)
    .maybeSingle();
  if (!client) {
    const { data: any } = await admin
      .from("clients")
      .select("id, nombre, ig_user_id")
      .not("ig_user_id", "is", null)
      .limit(1);
    client = any?.[0] ?? null;
  }
  if (!client?.ig_user_id) {
    return NextResponse.json({
      ...status,
      igtest: { ok: false, error: "Ningún cliente tiene ig_user_id conectado." },
    });
  }

  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publish-media/_test/test.jpg`;
  try {
    const { createDryRunContainer } = await import("@/lib/meta/publish");
    const res = await createDryRunContainer(client.ig_user_id, imageUrl);
    return NextResponse.json({
      ...status,
      igtest: { ok: true, cliente: client.nombre, ...res },
    });
  } catch (e) {
    return NextResponse.json({
      ...status,
      igtest: {
        ok: false,
        cliente: client.nombre,
        error: e instanceof Error ? e.message : "Error desconocido",
      },
    });
  }
}
