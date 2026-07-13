import { NextResponse } from "next/server";
import { requireUser, userHas } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { discoverLeads, type CampaignContext } from "@/lib/prospecting/discover";
import { verifyInstagramBatch } from "@/lib/prospecting/verify";
import {
  generateOutreachMessage,
  type LeadForMessage,
  type MessageContext,
} from "@/lib/prospecting/message";
import { friendlyAiError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  const me = await requireUser();
  // Buscar leads con IA consume tokens (dólares): gateado por la feature
  // `leads_ia`, que el dueño otorga en /accesos. Admin la tiene siempre.
  if (!userHas(me, "leads_ia"))
    return NextResponse.json(
      { error: "No tenés acceso al buscador de leads con IA. Pedíselo al admin." },
      { status: 403 }
    );

  const admin = createAdmin();
  const { data: camp, error: cErr } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, servicio, angulo, canal, idioma")
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
    canal: string;
    idioma: string;
  };

  // Empresas ya cargadas en la campaña: se las pasamos a la IA para que no las
  // repita (más leads nuevos por corrida).
  const { data: existing } = await admin
    .from("prospecting_leads")
    .select("empresa")
    .eq("campaign_id", c.id);
  const excludeEmpresas = ((existing ?? []) as { empresa: string }[]).map((e) => e.empresa);

  const body = (await req.json().catch(() => ({}))) as { cantidad?: number };
  const cantidad = Math.min(Math.max(body.cantidad ?? 20, 1), 24);

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
    excludeEmpresas,
  };

  // Buscamos en RONDAS de a 12 (la IA rinde mejor por tanda que pidiéndole 20 de
  // una) hasta juntar `cantidad`. Entre ronda y ronda sumamos lo encontrado a la
  // lista de exclusión para que no repita. maxDuration=300s cubre el tiempo extra.
  const PER_ROUND = 12;
  const rondas = Math.min(Math.ceil(cantidad / PER_ROUND), 2);
  const leads: Awaited<ReturnType<typeof discoverLeads>> = [];
  const vistas = new Set(excludeEmpresas.map((e) => e.toLowerCase().trim()));
  try {
    for (let r = 0; r < rondas && leads.length < cantidad; r++) {
      const faltan = Math.min(cantidad - leads.length, PER_ROUND);
      const tanda = await discoverLeads({ ...ctx, excludeEmpresas: [...vistas] }, faltan);
      for (const l of tanda) {
        const key = l.empresa.toLowerCase().trim();
        if (vistas.has(key)) continue; // ya la tenemos (de la campaña o de otra ronda)
        vistas.add(key);
        leads.push(l);
      }
      if (tanda.length === 0) break; // la IA no trajo nada nuevo: no insistas
    }
  } catch (e) {
    // Si ya juntamos algo en una ronda previa, seguimos con eso; si no, error.
    if (leads.length === 0) {
      console.error("discoverLeads:", e);
      return NextResponse.json({ error: friendlyAiError(e) }, { status: 400 });
    }
    console.warn("discoverLeads (ronda parcial):", (e as Error).message);
  }

  if (leads.length === 0)
    return NextResponse.json({
      created: 0,
      skipped: 0,
      message:
        "La búsqueda no trajo empresas nuevas con contacto. Probá afinar el rubro o la zona.",
    });

  // Verificar/corregir los Instagram con búsqueda web ANTES de guardar y de armar
  // el mensaje: que no le pasemos al equipo un perfil que no existe o está vacío.
  // El verificado queda guardado para mostrarlo en la tarjeta. Si todo el paso
  // falla, los leads quedan con su handle original sin verificar (no se pierde).
  const igVerif = new Map<
    string,
    { instagram: string | null; verificado: boolean }
  >();
  try {
    const verif = await verifyInstagramBatch(
      leads.map((l) => ({
        empresa: l.empresa,
        instagram: l.instagram,
        sitio_web: l.sitio_web,
        ciudad: l.ciudad,
        pais: l.pais,
      })),
      c.idioma
    );
    for (let i = 0; i < leads.length; i++) {
      const v = verif[i];
      if (!v) continue;
      leads[i].instagram = v.instagram; // corregido o null
      igVerif.set(leads[i].empresa, { instagram: v.instagram, verificado: v.verificado });
    }
  } catch (e) {
    console.warn("verifyInstagramBatch falló:", (e as Error).message);
  }

  // Auto-generar el primer mensaje de cada lead en paralelo, así llegan listos
  // para enviar (sin tener que clickear lead por lead). Si alguno falla, queda
  // sin mensaje y el botón "Generar mensajes" lo recupera después.
  const msgCtx: MessageContext = {
    rubro: c.rubro,
    servicioNombre,
    servicioDesc,
    angulo: c.angulo,
    canal: c.canal,
    idioma: c.idioma,
  };
  const mensajes = await Promise.all(
    leads.map(async (lead) => {
      try {
        const l: LeadForMessage = {
          empresa: lead.empresa,
          descripcion: lead.descripcion,
          ciudad: lead.ciudad,
          pais: lead.pais,
          instagram: lead.instagram,
          sitio_web: lead.sitio_web,
          por_que: lead.por_que,
          gancho: lead.gancho,
          idea: lead.idea,
        };
        return await generateOutreachMessage(l, msgCtx);
      } catch (e) {
        console.warn("auto-msg falló:", (e as Error).message);
        return null;
      }
    })
  );

  let created = 0;
  let skipped = 0;
  let conMensaje = 0;
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const mensaje = mensajes[i];
    const { error: insErr } = await admin.from("prospecting_leads").insert({
      campaign_id: c.id,
      empresa: lead.empresa,
      descripcion: lead.descripcion,
      ciudad: lead.ciudad,
      pais: lead.pais,
      sitio_web: lead.sitio_web,
      instagram: lead.instagram,
      instagram_verificado: igVerif.get(lead.empresa)?.verificado ?? null,
      telefono: lead.telefono,
      email: lead.email,
      por_que: lead.por_que,
      gancho: lead.gancho,
      idea: lead.idea,
      fit_score: lead.fit_score,
      fuente_url: lead.fuente_url,
      mensaje,
      fuente: "ia",
    });
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") skipped++;
      else console.warn("insert lead:", insErr.message);
      continue;
    }
    created++;
    if (mensaje) conMensaje++;
  }

  return NextResponse.json({ created, skipped, conMensaje, found: leads.length });
}
