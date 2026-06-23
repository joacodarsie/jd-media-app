"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai/errors";
import {
  generateOutreachMessage,
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
  const { data, error } = await supabase
    .from("prospecting_leads")
    .update({ estado })
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

  let servicioNombre: string | null = null;
  let servicioDesc: string | null = null;
  if (c.servicio) {
    const { data: svc } = await supabase
      .from("services")
      .select("name, description")
      .eq("slug", c.servicio)
      .maybeSingle();
    servicioNombre = (svc as { name?: string } | null)?.name ?? null;
    servicioDesc = (svc as { description?: string } | null)?.description ?? null;
  }

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
