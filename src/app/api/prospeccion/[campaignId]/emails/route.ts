import { NextResponse } from "next/server";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { completarEmails } from "@/lib/prospecting/email-fill";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

/**
 * Completa la columna `email` de los contactos que tienen sitio web.
 *
 * No gasta tokens: baja el HTML del sitio y lee el mail que la empresa publica.
 * Se procesa de a tandas para no pasarse del tiempo de ejecución; el botón se
 * puede apretar de nuevo hasta que no queden pendientes. El cron diario hace
 * esto mismo solo (ver `lib/email/cold-pipeline`), así que el botón quedó para
 * empujar una campaña puntual sin esperar a mañana.
 */
export async function POST(
  _req: Request,
  { params }: { params: { campaignId: string } }
) {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK))
    return NextResponse.json({ error: "Sin acceso a prospección." }, { status: 403 });

  const r = await completarEmails(createAdmin(), { campaignId: params.campaignId });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({
    revisados: r.revisados,
    encontrados: r.encontrados,
    pendientes: r.pendientes,
  });
}
