"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, canUseProspectingAi } from "@/lib/auth";
import { friendlyAiError } from "@/lib/ai/errors";
import {
  generateCampaignMessages as buildCampaignMessages,
} from "@/lib/prospecting/campaign-messages";
import {
  generateOutreachMessage,
  generateFollowupMessage,
  type LeadForMessage,
  type MessageContext,
} from "@/lib/prospecting/message";
import { verifyInstagramOne, toHandle } from "@/lib/prospecting/verify";
import { cargarCatalogoServicios } from "@/lib/prospecting/catalogo";
import {
  MENSAJE_BLOQUES,
  type CampaignMessages,
  type MensajeBloqueKey,
} from "@/lib/prospecting/shared";

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

/**
 * Verifica con búsqueda web que el Instagram del lead exista y sea de la empresa.
 * Corrige el handle si está mal, o lo deja en null si no encuentra uno real.
 * Guarda el resultado en instagram + instagram_verificado y devuelve el estado
 * para refrescar la card. Para los leads ya cargados con links dudosos.
 */
export async function verifyLeadInstagram(id: string) {
  const { supabase } = await ctx();
  const { data: lead, error } = await supabase
    .from("prospecting_leads")
    .select("id, campaign_id, empresa, instagram, sitio_web, ciudad, pais")
    .eq("id", id)
    .single();
  if (error || !lead) return { error: "No se encontró el lead." };
  const l = lead as {
    campaign_id: string;
    empresa: string;
    instagram: string | null;
    sitio_web: string | null;
    ciudad: string | null;
    pais: string | null;
  };

  const { data: camp } = await supabase
    .from("prospecting_campaigns")
    .select("idioma")
    .eq("id", l.campaign_id)
    .maybeSingle();

  let res;
  try {
    res = await verifyInstagramOne(
      {
        empresa: l.empresa,
        instagram: l.instagram,
        sitio_web: l.sitio_web,
        ciudad: l.ciudad,
        pais: l.pais,
      },
      (camp as { idioma?: string } | null)?.idioma ?? "es_ar"
    );
  } catch (e) {
    console.error("verifyLeadInstagram:", e);
    return { error: friendlyAiError(e) };
  }

  const { error: upErr } = await supabase
    .from("prospecting_leads")
    .update({ instagram: res.instagram, instagram_verificado: res.verificado })
    .eq("id", id);
  if (upErr) return { error: upErr.message };

  revalidatePath(`/prospeccion/${l.campaign_id}`);
  return {
    ok: true as const,
    instagram: res.instagram,
    verificado: res.verificado,
  };
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
      "id, campaign_id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que, gancho, idea"
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
    gancho: l.gancho,
    idea: l.idea,
  };
  const msgCtx: MessageContext = {
    rubro: c.rubro,
    servicioNombre,
    servicioDesc,
    servicioSlug: c.servicio,
    angulo: c.angulo,
    canal: c.canal,
    idioma: c.idioma,
    catalogo: await cargarCatalogoServicios(),
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
      "id, campaign_id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que, gancho, idea, mensaje"
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
        gancho: l.gancho,
        idea: l.idea,
      },
      {
        rubro: c.rubro,
        servicioNombre,
        servicioDesc,
        servicioSlug: c.servicio,
        angulo: c.angulo,
        canal: c.canal,
        idioma: c.idioma,
        catalogo: await cargarCatalogoServicios(),
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
    .select(
      "id, empresa, descripcion, ciudad, pais, instagram, sitio_web, por_que, gancho, idea"
    )
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
    servicioSlug: c.servicio,
    angulo: c.angulo,
    canal: c.canal,
    idioma: c.idioma,
    catalogo: await cargarCatalogoServicios(),
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
            gancho: l.gancho,
            idea: l.idea,
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

// ─────────────────────────────────────────────────────────────────────────────
// Contactos (modo rápido): tabla liviana tipo Excel, editable a mano.
// ─────────────────────────────────────────────────────────────────────────────

/** Campos editables de un contacto. Se guardan celda por celda (blur/change). */
export interface ContactPatch {
  empresa?: string;
  contacto_nombre?: string | null;
  contacto_rol?: string | null;
  telefono?: string | null;
  instagram?: string | null;
  sitio_web?: string | null;
  estado?: string;
  asignado_a?: string | null;
  notas?: string | null;
  /** true = el dato sirve; false = no se pudo contactar (dato mal cargado). */
  contactable?: boolean | null;
}

const CONTACT_ESTADOS_OK = ["nuevo", "contactado", "interesado", "reunion", "descartado"];

export async function updateContact(id: string, patch: ContactPatch) {
  const { supabase, userId } = await ctx();
  const clean = (v: string | null | undefined) =>
    v == null ? null : v.trim().slice(0, 160) || null;

  const update: Record<string, unknown> = {};
  if (patch.empresa !== undefined) {
    const empresa = clean(patch.empresa);
    if (!empresa) return { error: "La empresa no puede quedar vacía." };
    update.empresa = empresa;
  }
  if (patch.contacto_nombre !== undefined) update.contacto_nombre = clean(patch.contacto_nombre);
  if (patch.contacto_rol !== undefined) update.contacto_rol = clean(patch.contacto_rol);
  if (patch.telefono !== undefined) update.telefono = clean(patch.telefono);
  if (patch.instagram !== undefined)
    // Guardamos el handle pelado (sin @ ni URL) para que el link salga siempre bien.
    update.instagram = patch.instagram == null ? null : toHandle(patch.instagram);
  if (patch.sitio_web !== undefined) update.sitio_web = clean(patch.sitio_web);
  if (patch.notas !== undefined) update.notas = patch.notas == null ? null : patch.notas.trim().slice(0, 500) || null;
  if (patch.asignado_a !== undefined) update.asignado_a = patch.asignado_a || null;
  if (patch.contactable !== undefined) update.contactable = patch.contactable;
  if (patch.estado !== undefined) {
    const estado = CONTACT_ESTADOS_OK.includes(patch.estado) ? patch.estado : "nuevo";
    update.estado = estado;
    // Sellar la fecha de contacto la primera vez que sale de "nuevo"; limpiarla
    // si vuelve a "nuevo". Sirve para el seguimiento ("contactado hace Xd").
    if (estado === "nuevo") {
      update.contactado_at = null;
      update.reunion_at = null;
    } else {
      const { data: prev } = await supabase
        .from("prospecting_contacts")
        .select("contactado_at, asignado_a")
        .eq("id", id)
        .maybeSingle();
      const p = prev as { contactado_at: string | null; asignado_a: string | null } | null;
      if (!p?.contactado_at) update.contactado_at = new Date().toISOString();
      // Fecha de la reunión: la sella el momento en que se agenda, para poder
      // medir el flujo por semana en el tablero (y no solo la foto de hoy).
      if (estado === "reunion") update.reunion_at = new Date().toISOString();
      // Auto-asignar: si nadie lo tenía, queda a nombre de quien lo marcó. Así no
      // hay que tocar el selector de "quién contacta" en cada fila.
      if (!p?.asignado_a && patch.asignado_a === undefined) update.asignado_a = userId;
    }
  }

  if (Object.keys(update).length === 0) return { ok: true as const };

  let res = await supabase
    .from("prospecting_contacts")
    .update(update)
    .eq("id", id)
    .select("campaign_id")
    .single();
  // Resiliencia: si faltan la 0131 (contactado_at) o la 0136 (instagram/
  // sitio_web), reintentamos sin esas columnas para no romper la edición.
  if (res.error && (res.error as { code?: string }).code === "42703") {
    delete update.contactado_at;
    delete update.instagram;
    delete update.sitio_web;
    delete update.contactable;
    delete update.reunion_at;
    if (Object.keys(update).length > 0) {
      res = await supabase
        .from("prospecting_contacts")
        .update(update)
        .eq("id", id)
        .select("campaign_id")
        .single();
    }
  }
  if (res.error) {
    if ((res.error as { code?: string }).code === "23505")
      return { error: "Ya hay un contacto con esa empresa en la campaña." };
    return { error: res.error.message };
  }
  revalidatePath(`/prospeccion/${(res.data as { campaign_id: string }).campaign_id}/contactos`);
  return { ok: true as const };
}

/** Marca el estado de VARIOS contactos de una (selección múltiple en la tabla). */
export async function bulkSetContactoEstado(ids: string[], estado: string) {
  const { supabase, userId } = await ctx();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true as const, n: 0 };
  const est = CONTACT_ESTADOS_OK.includes(estado) ? estado : "nuevo";
  const clean = ids.slice(0, 500);

  if (est === "nuevo") {
    let res = await supabase
      .from("prospecting_contacts")
      .update({ estado: est, contactado_at: null, reunion_at: null })
      .in("id", clean);
    if (res.error && (res.error as { code?: string }).code === "42703")
      res = await supabase
        .from("prospecting_contacts")
        .update({ estado: est, contactado_at: null })
        .in("id", clean);
    if (res.error && (res.error as { code?: string }).code === "42703")
      res = await supabase.from("prospecting_contacts").update({ estado: est }).in("id", clean);
    if (res.error) return { error: res.error.message };
  } else {
    // Sellar la fecha de contacto a los que no la tenían (sin pisar la existente).
    const stamp = await supabase
      .from("prospecting_contacts")
      .update({ contactado_at: new Date().toISOString() })
      .in("id", clean)
      .is("contactado_at", null);
    // Si falla por falta de columna (0131), seguimos: no es crítico.
    if (stamp.error && (stamp.error as { code?: string }).code !== "42703")
      console.warn("bulk contactado_at:", stamp.error.message);
    // Auto-asignar a quien marcó, solo a los que estaban sin dueño.
    const assign = await supabase
      .from("prospecting_contacts")
      .update({ asignado_a: userId })
      .in("id", clean)
      .is("asignado_a", null);
    if (assign.error) console.warn("bulk asignado_a:", assign.error.message);
    // Sellar la fecha de la reunión a los que la agendan ahora (sin pisar).
    if (est === "reunion") {
      const r = await supabase
        .from("prospecting_contacts")
        .update({ reunion_at: new Date().toISOString() })
        .in("id", clean)
        .is("reunion_at", null);
      if (r.error && (r.error as { code?: string }).code !== "42703")
        console.warn("bulk reunion_at:", r.error.message);
    }
    const res = await supabase
      .from("prospecting_contacts")
      .update({ estado: est })
      .in("id", clean);
    if (res.error) return { error: res.error.message };
  }

  // Revalidamos por la campaña del primer contacto (todos son de la misma).
  const { data } = await supabase
    .from("prospecting_contacts")
    .select("campaign_id")
    .eq("id", clean[0])
    .maybeSingle();
  const cid = (data as { campaign_id?: string } | null)?.campaign_id;
  if (cid) revalidatePath(`/prospeccion/${cid}/contactos`);
  return { ok: true as const, n: clean.length };
}

/**
 * Marca en lote si el dato de contacto SIRVE o no. Es distinto del estado:
 * "no se pudo contactar" (dato mal cargado) no es lo mismo que "no le interesó".
 */
export async function bulkSetContactable(ids: string[], contactable: boolean | null) {
  const { supabase } = await ctx();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true as const, n: 0 };
  const clean = ids.slice(0, 500);
  const { data } = await supabase
    .from("prospecting_contacts")
    .select("campaign_id")
    .eq("id", clean[0])
    .maybeSingle();
  const { error } = await supabase
    .from("prospecting_contacts")
    .update({ contactable })
    .in("id", clean);
  if (error) {
    if ((error as { code?: string }).code === "42703")
      return { error: "Falta aplicar la migración 0138 (contactable)." };
    return { error: error.message };
  }
  const cid = (data as { campaign_id?: string } | null)?.campaign_id;
  if (cid) revalidatePath(`/prospeccion/${cid}/contactos`);
  return { ok: true as const, n: clean.length };
}

/** Borra VARIOS contactos de una. */
export async function bulkDeleteContacts(ids: string[]) {
  const { supabase } = await ctx();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true as const, n: 0 };
  const clean = ids.slice(0, 500);
  const { data } = await supabase
    .from("prospecting_contacts")
    .select("campaign_id")
    .eq("id", clean[0])
    .maybeSingle();
  const { error } = await supabase.from("prospecting_contacts").delete().in("id", clean);
  if (error) return { error: error.message };
  const cid = (data as { campaign_id?: string } | null)?.campaign_id;
  if (cid) revalidatePath(`/prospeccion/${cid}/contactos`);
  return { ok: true as const, n: clean.length };
}

export async function deleteContact(id: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("prospecting_contacts")
    .delete()
    .eq("id", id)
    .select("campaign_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/prospeccion/${(data as { campaign_id: string }).campaign_id}/contactos`);
  return { ok: true as const };
}

export async function addManualContact(
  campaignId: string,
  input: { empresa: string; contacto_nombre?: string | null; contacto_rol?: string | null; telefono?: string | null }
) {
  const { supabase, userId } = await ctx();
  if (!input.empresa.trim()) return { error: "Falta el nombre de la empresa." };
  const { data, error } = await supabase
    .from("prospecting_contacts")
    .insert({
      campaign_id: campaignId,
      empresa: input.empresa.trim().slice(0, 160),
      contacto_nombre: input.contacto_nombre?.trim() || null,
      contacto_rol: input.contacto_rol?.trim() || null,
      telefono: input.telefono?.trim() || null,
      created_by: userId,
      fuente: "manual",
    })
    .select("id")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505")
      return { error: "Esa empresa ya está en la lista de contactos." };
    return { error: error.message };
  }
  revalidatePath(`/prospeccion/${campaignId}/contactos`);
  return { ok: true as const, id: (data as { id: string }).id };
}

/**
 * Genera (y guarda) la plantilla de mensajes de la campaña con IA. Reservado al
 * director (consume tokens). Devuelve los mensajes para mostrarlos al toque.
 */
export async function regenerateCampaignMessages(campaignId: string) {
  const me = await requireUser();
  if (!canUseProspectingAi(me))
    return { error: "No tenés habilitada la IA de prospección. Pedísela al director." };
  const { supabase } = await ctx();

  const { data: camp } = await supabase
    .from("prospecting_campaigns")
    .select("rubro, ubicacion, servicio, angulo, canal, idioma")
    .eq("id", campaignId)
    .single();
  if (!camp) return { error: "No se encontró la campaña." };
  const c = camp as {
    rubro: string;
    ubicacion: string | null;
    servicio: string | null;
    angulo: string | null;
    canal: string;
    idioma: string;
  };
  const { servicioNombre, servicioDesc } = await loadServicio(supabase, c.servicio);

  let messages;
  try {
    messages = await buildCampaignMessages({
      rubro: c.rubro,
      ubicacion: c.ubicacion,
      servicioNombre,
      servicioDesc,
      servicioSlug: c.servicio,
      angulo: c.angulo,
      canal: c.canal,
      idioma: c.idioma,
      // Los firma quien los genera: si los saca Guille, no puede decir "soy Joaquín".
      autorNombre: me.nombre,
      // Sin el catálogo real, la IA ofrece servicios que no vendemos.
      catalogo: await cargarCatalogoServicios(),
    });
  } catch (e) {
    console.error("regenerateCampaignMessages:", e);
    return { error: friendlyAiError(e) };
  }
  if (!messages) return { error: "La IA no devolvió los mensajes. Probá de nuevo." };

  // Regenerar pisa los textos, pero NO la elección: si el equipo venía usando
  // "alternativa" para escribirle a los contactos, sigue usando esa.
  const { data: prevTpl } = await supabase
    .from("prospecting_campaigns")
    .select("mensajes_plantilla")
    .eq("id", campaignId)
    .maybeSingle();
  const elegidoPrevio = (
    (prevTpl as { mensajes_plantilla?: CampaignMessages | null } | null)?.mensajes_plantilla ?? null
  )?.elegido;

  // Guardar (resiliente si falta la 0132: igual devolvemos los mensajes).
  const { error: upErr } = await supabase
    .from("prospecting_campaigns")
    .update({
      mensajes_plantilla: elegidoPrevio ? { ...messages, elegido: elegidoPrevio } : messages,
    })
    .eq("id", campaignId);
  const saved = !upErr;
  if (upErr && (upErr as { code?: string }).code !== "42703")
    console.warn("guardar mensajes_plantilla:", upErr.message);

  revalidatePath(`/prospeccion/${campaignId}`);
  return { ok: true as const, messages, saved };
}

/**
 * Guarda los mensajes de la campaña editados a mano y/o cuál es el que se usa
 * para escribirle a los contactos. No consume IA: lo puede hacer cualquiera del
 * equipo con acceso a Prospección (el que escribe sabe mejor que la IA qué
 * funciona en su rubro).
 */
export async function saveCampaignMessages(
  campaignId: string,
  patch: { mensajes?: Partial<CampaignMessages>; elegido?: MensajeBloqueKey }
): Promise<{ ok: true; messages: CampaignMessages } | { error: string }> {
  const { supabase } = await ctx();

  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .select("mensajes_plantilla")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return { error: error.message };

  const actual = ((data as { mensajes_plantilla?: CampaignMessages | null } | null)
    ?.mensajes_plantilla ?? null) as CampaignMessages | null;
  if (!actual) return { error: "Esta campaña todavía no tiene mensajes generados." };

  const limpio = (v: unknown): string | undefined =>
    typeof v === "string" ? v.trim().slice(0, 4000) : undefined;

  const merged: CampaignMessages = { ...actual };
  for (const { key } of MENSAJE_BLOQUES) {
    const nuevo = limpio(patch.mensajes?.[key]);
    if (nuevo !== undefined) merged[key] = nuevo;
  }
  if (patch.elegido) {
    if (!MENSAJE_BLOQUES.some((b) => b.key === patch.elegido))
      return { error: "Ese bloque de mensaje no existe." };
    if (!merged[patch.elegido]?.trim())
      return { error: "No podés elegir un mensaje vacío para escribirle a los contactos." };
    merged.elegido = patch.elegido;
  }

  const { error: upErr } = await supabase
    .from("prospecting_campaigns")
    .update({ mensajes_plantilla: merged })
    .eq("id", campaignId);
  if (upErr) {
    if ((upErr as { code?: string }).code === "42703")
      return { error: "Falta aplicar la migración 0132 para poder guardar los mensajes." };
    return { error: upErr.message };
  }

  revalidatePath(`/prospeccion/${campaignId}`);
  revalidatePath(`/prospeccion/${campaignId}/contactos`);
  return { ok: true as const, messages: merged };
}

export interface BulkContact {
  empresa: string;
  contacto_nombre?: string | null;
  contacto_rol?: string | null;
  telefono?: string | null;
  instagram?: string | null;
}

/**
 * Importado masivo (0 tokens de IA): carga muchas filas de una, pegadas desde
 * Google Maps / Excel. Deduplica contra lo ya cargado y dentro del mismo lote.
 * Devuelve cuántas entraron y cuántas se saltearon por repetidas.
 */
export async function addContactsBulk(campaignId: string, items: BulkContact[]) {
  const { supabase, userId } = await ctx();
  if (!Array.isArray(items) || items.length === 0)
    return { error: "No hay filas para importar." };

  // Existentes en la campaña, para no repetir.
  const { data: existing, error: exErr } = await supabase
    .from("prospecting_contacts")
    .select("empresa")
    .eq("campaign_id", campaignId);
  if (exErr) {
    if ((exErr as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0130 (contactos)." };
    return { error: exErr.message };
  }
  const vistas = new Set(
    ((existing ?? []) as { empresa: string }[]).map((e) => e.empresa.toLowerCase().trim())
  );

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const it of items.slice(0, 500)) {
    const empresa = (it.empresa ?? "").trim().slice(0, 160);
    if (!empresa) continue;
    const key = empresa.toLowerCase();
    if (vistas.has(key)) {
      skipped++;
      continue;
    }
    vistas.add(key);
    rows.push({
      campaign_id: campaignId,
      empresa,
      contacto_nombre: it.contacto_nombre?.trim().slice(0, 120) || null,
      contacto_rol: it.contacto_rol?.trim().slice(0, 120) || null,
      telefono: it.telefono?.trim().slice(0, 40) || null,
      instagram: toHandle(it.instagram),
      created_by: userId,
      fuente: "manual",
    });
  }

  if (rows.length === 0)
    return { ok: true as const, created: 0, skipped };

  let { error } = await supabase.from("prospecting_contacts").insert(rows);
  // Sin la 0136 todavía: importamos igual, sin el Instagram.
  if (error && (error as { code?: string }).code === "42703") {
    for (const r of rows) delete r.instagram;
    ({ error } = await supabase.from("prospecting_contacts").insert(rows));
  }
  if (error) return { error: error.message };

  revalidatePath(`/prospeccion/${campaignId}/contactos`);
  return { ok: true as const, created: rows.length, skipped };
}
