import { NextResponse } from "next/server";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { discoverLeads, type CampaignContext } from "@/lib/prospecting/discover";
import { friendlyAiError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Acceso: staff o comercial/prospecting. */
async function canProspect(rol: string) {
  return isStaff(rol) || rol === "comercial" || rol === "prospecting";
}

export async function POST(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  const me = await requireUser();
  if (!(await canProspect(me.rol)))
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });

  const admin = createAdmin();
  const { data: camp, error: cErr } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, servicio, angulo, idioma")
    .eq("id", params.campaignId)
    .maybeSingle();
  if (cErr && (cErr as { code?: string }).code === "42P01")
    return NextResponse.json({ error: "Falta aplicar la migración 0097." }, { status: 400 });
  if (!camp) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  const c = camp as {
    id: string;
    nombre: string;
    rubro: string;
    ubicacion: string | null;
    servicio: string | null;
    angulo: string | null;
    idioma: string;
  };

  const body = (await req.json().catch(() => ({}))) as { cantidad?: number };
  const cantidad = Math.min(Math.max(body.cantidad ?? 6, 1), 12);

  // Nombre/descripción del servicio para contexto del prospector.
  let servicioNombre: string | null = null;
  let servicioDesc: string | null = null;
  if (c.servicio) {
    const { data: svc } = await admin
      .from("services")
      .select("name, description")
      .eq("slug", c.servicio)
      .maybeSingle();
    servicioNombre = (svc as { name?: string } | null)?.name ?? null;
    servicioDesc = (svc as { description?: string } | null)?.description ?? null;
  }

  const ctx: CampaignContext = {
    nombre: c.nombre,
    rubro: c.rubro,
    ubicacion: c.ubicacion,
    servicioNombre,
    servicioDesc,
    angulo: c.angulo,
    idioma: c.idioma,
  };

  let leads;
  try {
    leads = await discoverLeads(ctx, cantidad);
  } catch (e) {
    console.error("discoverLeads:", e);
    return NextResponse.json({ error: friendlyAiError(e) }, { status: 400 });
  }

  if (leads.length === 0)
    return NextResponse.json({
      created: 0,
      skipped: 0,
      message:
        "La búsqueda no trajo empresas con contacto. Probá afinar el rubro o la zona.",
    });

  let created = 0;
  let skipped = 0;
  for (const lead of leads) {
    const { error: insErr } = await admin.from("prospecting_leads").insert({
      campaign_id: c.id,
      empresa: lead.empresa,
      descripcion: lead.descripcion,
      ciudad: lead.ciudad,
      pais: lead.pais,
      sitio_web: lead.sitio_web,
      instagram: lead.instagram,
      telefono: lead.telefono,
      email: lead.email,
      por_que: lead.por_que,
      fit_score: lead.fit_score,
      fuente_url: lead.fuente_url,
      fuente: "ia",
    });
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") skipped++;
      else console.warn("insert lead:", insErr.message);
      continue;
    }
    created++;
  }

  return NextResponse.json({ created, skipped, found: leads.length });
}
