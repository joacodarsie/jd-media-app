import { NextResponse } from "next/server";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { buscarEmailDeSitio } from "@/lib/prospecting/email-finder";
import { esEmailValido, normalizarEmail } from "@/lib/prospecting/cold-email";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

/** Cuántos sitios visitar por tanda (el resto queda para el próximo clic). */
const TANDA = 40;
/** Sitios en paralelo. Más que esto empieza a dar timeouts en sitios lentos. */
const CONCURRENCIA = 6;

/**
 * Completa la columna `email` de los contactos que tienen sitio web.
 *
 * No gasta tokens: baja el HTML del sitio y lee el mail que la empresa publica.
 * Se procesa de a tandas para no pasarse del tiempo de ejecución; el botón se
 * puede apretar de nuevo hasta que no queden pendientes.
 */
export async function POST(
  _req: Request,
  { params }: { params: { campaignId: string } }
) {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK))
    return NextResponse.json({ error: "Sin acceso a prospección." }, { status: 403 });

  const admin = createAdmin();
  const { data: contactos, error } = await admin
    .from("prospecting_contacts")
    .select("id, empresa, sitio_web, email")
    .eq("campaign_id", params.campaignId)
    .not("sitio_web", "is", null)
    .is("email", null)
    .limit(TANDA);

  if (error) {
    if ((error as { code?: string }).code === "42703")
      return NextResponse.json(
        { error: "Falta aplicar la migración 0142 (columna email)." },
        { status: 400 }
      );
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const lista = contactos ?? [];
  let encontrados = 0;

  for (let i = 0; i < lista.length; i += CONCURRENCIA) {
    const tanda = lista.slice(i, i + CONCURRENCIA);
    await Promise.all(
      tanda.map(async (c) => {
        const email = await buscarEmailDeSitio(c.sitio_web as string);
        if (!email || !esEmailValido(email)) return;
        const { error: upErr } = await admin
          .from("prospecting_contacts")
          .update({ email: normalizarEmail(email) })
          .eq("id", c.id);
        if (!upErr) encontrados++;
      })
    );
  }

  const { count: quedan } = await admin
    .from("prospecting_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.campaignId)
    .not("sitio_web", "is", null)
    .is("email", null);

  return NextResponse.json({
    revisados: lista.length,
    encontrados,
    pendientes: quedan ?? 0,
  });
}
