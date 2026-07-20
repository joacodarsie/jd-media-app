import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkMetaToken } from "@/lib/meta/health";

export const dynamic = "force-dynamic";

/**
 * Salud del token de Meta a demanda (solo admin): validez, permisos,
 * expiración y qué scopes faltan según lo que la app necesita.
 * Útil tras regenerar el system user token en Business Manager.
 */
export async function GET() {
  const me = await requireUser();
  if (me.rol !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }
  const status = await checkMetaToken();
  return NextResponse.json(status);
}
