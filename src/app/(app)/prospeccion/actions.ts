"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai/errors";
import {
  generateOutreachMessage,
  generateFollowupMessage,
  type LeadForMessage,
  type MessageContext,
} from "@/lib/prospecting/message";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export interface CampaignInput {
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  servicio: string | null;
  angulo: string | null;
  canal: string;
  idioma: string;
}

export async function createCampaign(input: CampaignInput) {
  const { supabase, userId } = await ctx();
  if (!input.nombre.trim() || !input.rubro.trim())
    return { error: "Falta el nombre o el rubro de la campaña." };
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .insert({
      nombre: input.nombre.trim().slice(0, 120),
      rubro: input.rubro.trim().slice(0, 160),
      ubicacion: input.ubicacion?.trim() || null,
      servicio: input.servicio || null,
      angulo: input.angulo?.trim() || null,
      canal: input.canal || "whatsapp",
      idioma: input.idioma || "es_ar",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear: " + (error?.message ?? "") };
  revalidatePath("/prospeccion");
  return { ok: true as const, id: data.id as string };
}

export async function updateCampaign(id: string, input: CampaignInput) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("prospecting_campaigns")
    .update({
      nombre: input.nombre.trim().slice(0, 120),
      rubro: input.rubro.trim().slice(0, 160),
      ubicacion: input.ubicacion?.trim() || null,
      servicio: input.servicio || null,
      angulo: input.angulo?.trim() || null,
      canal: input.canal || "whatsapp",
      idioma: input.idioma || "es_ar",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion");
  revalidatePath(`/prospeccion/${id}`);
  return { ok: true as const };
}

export async function setCampaignEstado(id: string, estado: "activa" | "pausada") {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("prospecting_campaigns")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion");
  revalidatePath(`/prospeccion/${id}`);
  return { ok: true as const };
}

export async function deleteCampaign(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("prospecting_campaigns").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion");
  return { ok: true as const };
}

export interface ManualLeadInput {
  empresa: string;
  descripcion: string | null;
  ciudad: string | null;
  pais: string | null;
  sitio_web: string | null;
  instagram: string | null;
  telefono: string | null;
  email: string | null;
  por_que: string | null;
}

export async function addManualLead(campaignId: string, input: ManualLeadInput) {
  const { supabase } = await ctx();
  if (!input.empresa.trim()) return { error: "Falta el nombre de la empresa." };
  const { error } = await supabase.from("prospecting_leads").insert({
    campaign_id: campaignId,
    empresa: input.empresa.trim().slice(0, 160),
    descripcion: input.descripcion?.trim() || null,
    ciudad: input.ciudad?.trim() || null,
    pais: input.pais?.trim() || null,
    sitio_web: input.sitio_web?.trim() || null,
    instagram: input.instagram?.trim() || null,
    telefono: input.telefono?.trim() || null,
    email: input.email?.trim() || null,
    por_que: input.por_que?.trim() || null,
    fuente: "manual",
  });
  if (error) {
    if ((error as { code?: string }).code === "23505")
      return { error: "Esa empresa ya está cargada en esta campaña." };
    return { error: error.message };
  }
  revalidatePath(`/prospeccion/${campaignId}`);
  return { ok: true as const };
}

export async function setLeadEstado(id: string, estado: string) {
  const { supabase } = await ctx();
  // Al pasar a "contactado" por primera vez, sellar la fecha (para priorizar
  // seguimientos). No la pisamos si ya estaba.
  const patch: Record<string, unknown> = { estado };
  if (estado === "contactado") {
    const { data: prev } = await supabase
      .from("prospecting_leads")
      .select("contactado_at")
      .eq("id", id)
      .single();
    if (!(prev as { contactado_at: string | null } | null)?.contactado_at)
      patch.contactado_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("prospecting_leads")
    .update(patch)
    .eq("id", id)
    .select("campaign_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/prospeccion/${(data as { campaign_id: string }).campaign_id}`);
  return { ok: true as const };
}

export async function updateLeadNotes(id: string, notas: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("prospecting_leads")
    .update({ notas: notas.trim() || null })
    .eq("id", id)
    .select("campaign_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/prospeccion/${(data as { campaign_id: string }).campaign_id}`);
  return { ok: true as const };
}

export async function deleteLead(id: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("prospecting_leads")
    .delete()
    .eq("id", id)
    .select("campaign_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/prospeccion/${(data as { campaign_id: string }).campaign_id}`);
  return { ok: true as const };
}

/** Nombre/descripción del servicio de la campaña, para el contexto del mensaje. */
async function loadServicio(
  supabase: Awaited<ReturnType<typeof ctx>>["supabase"],
  servicioSlug: string | null
) {
  if (!servicioSlug) return { servicioNombre: null, servicioDesc: null };
  const { data: svc } = await supabase
    .from("services")
    .select("name, description")
    .eq("slug", servicioSlug)
    .maybeSingle();
  return {
    servicioNombre: (svc as { name?: string } | null)?.name ?? null,
    servicioDesc: (svc as { description?: string } | null)?.description ?? null,
  };
}

/**
 * Genera (o regenera) el primer mensaje personalizado de un lead con IA y lo
 * guarda. Devuelve el texto para refrescar la card al toque.
 */
export async function generateLeadMessage(id: string) {
  const { supabase } = await ctx();
  const { data: lead, error } = await supabase
    .from("prospecting_leads")
    .select(
      "id, campaign_id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que"
    )
    .eq("id", id)
    .single();
  if (error || !lead) return { error: "No se encontró el lead." };

  const { data: camp } = await supabase
    .from("prospecting_campaigns")
    .select("rubro, servicio, angulo, canal, idioma")
    .eq("id", (lead as { campaign_id: string }).campaign_id)
    .single();
  if (!camp) return { error: "No se encontró la campaña." };

  const c = camp as {
    rubro: string;
    servicio: string | null;
    angulo: string | null;
    canal: string;
    idioma: string;
  };

  const { servicioNombre, servicioDesc } = await loadServicio(supabase, c.servicio);

  const l = lead as LeadForMessage & { campaign_id: string };
  const leadCtx: LeadForMessage = {
    empresa: l.empresa,
    descripcion: l.descripcion,
    ciudad: l.ciudad,
    pais: l.pais,
    instagram: l.instagram,
    sitio_web: l.sitio_web,
    por_que: l.por_que,
  };
  const msgCtx: MessageContext = {
    rubro: c.rubro,
    servicioNombre,
    servicioDesc,
    angulo: c.angulo,
    canal: c.canal,
    idioma: c.idioma,
  };

  let mensaje: string | null;
  try {
    mensaje = await generateOutreachMessage(leadCtx, msgCtx);
  } catch (e) {
    console.error("generateLeadMessage:", e);
    return { error: friendlyAiError(e) };
  }
  if (!mensaje) return { error: "La IA no devolvió un mensaje. Probá de nuevo." };

  const { error: upErr } = await supabase
    .from("prospecting_leads")
    .update({ mensaje })
    .eq("id", id);
  if (upErr) return { error: upErr.message };

  revalidatePath(`/prospeccion/${l.campaign_id}`);
  return { ok: true as const, mensaje };
}

/**
 * Genera el mensaje de SEGUIMIENTO (follow-up) para un lead ya contactado que no
 * respondió, y lo guarda en `seguimiento`. Segundo toque = donde se cierra.
 */
export async function generateLeadFollowup(id: string) {
  const { supabase } = await ctx();
  const { data: lead, error } = await supabase
    .from("prospecting_leads")
    .select(
      "id, campaign_id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que, mensaje"
    )
    .eq("id", id)
    .single();
  if (error || !lead) return { error: "No se encontró el lead." };

  const { data: camp } = await supabase
    .from("prospecting_campaigns")
    .select("rubro, servicio, angulo, canal, idioma")
    .eq("id", (lead as { campaign_id: string }).campaign_id)
    .single();
  if (!camp) return { error: "No se encontró la campaña." };
  const c = camp as {
    rubro: string;
    servicio: string | null;
    angulo: string | null;
    canal: string;
    idioma: string;
  };
  const { servicioNombre, servicioDesc } = await loadServicio(supabase, c.servicio);

  const l = lead as LeadForMessage & { campaign_id: string; mensaje: string | null };
  let seguimiento: string | null;
  try {
    seguimiento = await generateFollowupMessage(
      {
        empresa: l.empresa,
        descripcion: l.descripcion,
        ciudad: l.ciudad,
        pais: l.pais,
        instagram: l.instagram,
        sitio_web: l.sitio_web,
        por_que: l.por_que,
      },
      {
        rubro: c.rubro,
        servicioNombre,
        servicioDesc,
        angulo: c.angulo,
        canal: c.canal,
        idioma: c.idioma,
      },
      l.mensaje
    );
  } catch (e) {
    console.error("generateLeadFollowup:", e);
    return { error: friendlyAiError(e) };
  }
  if (!seguimiento) return { error: "La IA no devolvió un seguimiento. Probá de nuevo." };

  const { error: upErr } = await supabase
    .from("prospecting_leads")
    .update({ seguimiento })
    .eq("id", id);
  if (upErr) return { error: upErr.message };

  revalidatePath(`/prospeccion/${l.campaign_id}`);
  return { ok: true as const, seguimiento };
}

/**
 * Genera el primer mensaje para TODOS los leads de la campaña que todavía no lo
 * tienen (los que quedaron sin mensaje al descubrir, o los cargados a mano).
 * Devuelve cuántos generó.
 */
export async function generateAllMessages(campaignId: string) {
  const { supabase } = await ctx();
  const { data: camp } = await supabase
    .from("prospecting_campaigns")
    .select("rubro, servicio, angulo, canal, idioma")
    .eq("id", campaignId)
    .single();
  if (!camp) return { error: "No se encontró la campaña." };
  const c = camp as {
    rubro: string;
    servicio: string | null;
    angulo: string | null;
    canal: string;
    idioma: string;
  };

  const { data: leads } = await supabase
    .from("prospecting_leads")
    .select("id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que")
    .eq("campaign_id", campaignId)
    .is("mensaje", null)
    .neq("estado", "descartado");
  const rows = (leads ?? []) as (LeadForMessage & { id: string })[];
  if (rows.length === 0) return { ok: true as const, generated: 0 };

  const { servicioNombre, servicioDesc } = await loadServicio(supabase, c.servicio);
  const msgCtx: MessageContext = {
    rubro: c.rubro,
    servicioNombre,
    servicioDesc,
    angulo: c.angulo,
    canal: c.canal,
    idioma: c.idioma,
  };

  const results = await Promise.all(
    rows.map(async (l) => {
      try {
        const mensaje = await generateOutreachMessage(
          {
            empresa: l.empresa,
            descripcion: l.descripcion,
            ciudad: l.ciudad,
            pais: l.pais,
            instagram: l.instagram,
            sitio_web: l.sitio_web,
            por_que: l.por_que,
          },
          msgCtx
        );
        if (!mensaje) return false;
        const { error } = await supabase
          .from("prospecting_leads")
          .update({ mensaje })
          .eq("id", l.id);
        return !error;
      } catch (e) {
        console.warn("generateAllMessages lead:", (e as Error).message);
        return false;
      }
    })
  );
  const generated = results.filter(Boolean).length;
  revalidatePath(`/prospeccion/${campaignId}`);
  if (generated === 0)
    return { error: "No se pudo generar ningún mensaje. Probá de nuevo." };
  return { ok: true as const, generated };
}

/**
 * Convierte un lead en una PROPUESTA (cliente en estado "propuesta", no cuenta
 * hasta activarlo al pagar). Engancha con el flujo comercial existente.
 */
export async function convertLeadToProposal(id: string) {
  const { supabase, userId } = await ctx();
  const { data: lead, error } = await supabase
    .from("prospecting_leads")
    .select("id, campaign_id, empresa, email, telefono, cliente_id")
    .eq("id", id)
    .single();
  if (error || !lead) return { error: "No se encontró el lead." };
  const l = lead as {
    id: string;
    campaign_id: string;
    empresa: string;
    email: string | null;
    telefono: string | null;
    cliente_id: string | null;
  };
  if (l.cliente_id) return { error: "Este lead ya tiene una propuesta creada." };

  const { data: created, error: cErr } = await supabase
    .from("clients")
    .insert({
      nombre: l.empresa.slice(0, 120),
      estado: "propuesta",
      contacto_email: l.email,
      contacto_telefono: l.telefono,
      cerrado_por_id: userId,
      fecha_inicio: null,
    })
    .select("id")
    .single();
  if (cErr || !created)
    return { error: "No se pudo crear la propuesta: " + (cErr?.message ?? "") };

  await supabase
    .from("prospecting_leads")
    .update({ estado: "ganado", cliente_id: (created as { id: string }).id })
    .eq("id", id);

  revalidatePath(`/prospeccion/${l.campaign_id}`);
  revalidatePath("/comercial");
  revalidatePath("/clientes");
  return { ok: true as const, clientId: (created as { id: string }).id };
}
