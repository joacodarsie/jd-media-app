"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, userHas } from "@/lib/auth";
import { PACK_DEFAULTS } from "@/lib/constants";

/**
 * Para un servicio de gestión de redes, devuelve el pack y su detalle (posts/
 * reels/historias) por defecto, así el servicio NUNCA queda sin pack. Los otros
 * servicios no llevan pack. `pack` recibido tiene prioridad si viene.
 */
function gestionPackFields(tipo: string | null, pack?: string | null) {
  if (tipo !== "gestion_redes") return { pack: null, pack_detalle: {} };
  const p = pack && PACK_DEFAULTS[pack] ? pack : "Presencia";
  const def = PACK_DEFAULTS[p];
  return {
    pack: p,
    pack_detalle: def
      ? { posts: def.posts, historias_dias: def.historias_dias, reels: def.reels }
      : {},
  };
}

/** Roles que pueden cerrar ventas / cargar propuestas. */
const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];
function canComercial(me: { rol: string; rol_secundario?: string | null; permisos?: Record<string, boolean> | null }) {
  return (
    COMERCIAL_ROLES.includes(me.rol) ||
    (!!me.rol_secundario && COMERCIAL_ROLES.includes(me.rol_secundario)) ||
    userHas(me as never, "comercial")
  );
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export type LeadStage =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

export interface LeadInput {
  id?: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  origen: string | null;
  servicio_interesado: string | null;
  monto_estimado: number | null;
  moneda: string;
  stage: LeadStage;
  asignado_a_id: string | null;
  notas: string | null;
  proxima_accion: string | null;
  proxima_accion_at: string | null;
  perdido_motivo: string | null;
}

function clean(input: LeadInput) {
  return {
    nombre: input.nombre.trim(),
    empresa: input.empresa?.trim() || null,
    email: input.email?.trim() || null,
    telefono: input.telefono?.trim() || null,
    origen: input.origen?.trim() || null,
    servicio_interesado: input.servicio_interesado || null,
    monto_estimado: input.monto_estimado,
    moneda: input.moneda || "ARS",
    stage: input.stage,
    asignado_a_id: input.asignado_a_id || null,
    notas: input.notas?.trim() || null,
    proxima_accion: input.proxima_accion?.trim() || null,
    proxima_accion_at: input.proxima_accion_at || null,
    perdido_motivo: input.perdido_motivo?.trim() || null,
  };
}

export async function upsertLead(input: LeadInput) {
  const { supabase, userId } = await ctx();
  if (!input.nombre.trim()) return { error: "Falta nombre." };

  if (input.id) {
    const { error } = await supabase
      .from("leads")
      .update(clean(input))
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("leads")
      .insert({ ...clean(input), created_by_id: userId });
    if (error) return { error: error.message };
  }
  revalidatePath("/comercial");
  return { ok: true };
}

export async function deleteLead(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/comercial");
  return { ok: true };
}

export async function changeLeadStage(id: string, stage: LeadStage) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("leads")
    .update({ stage })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/comercial");
  return { ok: true };
}

export async function assignLead(id: string, userId: string | null) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("leads")
    .update({ asignado_a_id: userId })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/comercial");
  return { ok: true };
}

/**
 * Convierte un lead en cliente real. Crea fila en clients y
 * (si el lead tenía servicio interesado) en client_services.
 * Vincula ganado_cliente_id en el lead y lo marca como "ganado".
 */
export async function convertLeadToClient(leadId: string) {
  const { supabase } = await ctx();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { error: leadErr?.message ?? "Lead no encontrado" };
  }
  if (lead.ganado_cliente_id) {
    return {
      error: "Este lead ya fue convertido. Cliente: " + lead.ganado_cliente_id,
    };
  }

  const clientName = (lead.empresa?.trim() || lead.nombre?.trim() || "Cliente").slice(
    0,
    120
  );

  const { data: created, error: cErr } = await supabase
    .from("clients")
    .insert({
      nombre: clientName,
      contacto_nombre: lead.empresa ? lead.nombre : null,
      contacto_email: lead.email,
      contacto_telefono: lead.telefono,
      monto_mensual: lead.monto_estimado,
      notas: lead.notas,
      fecha_inicio: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (cErr || !created) {
    return { error: "No se pudo crear el cliente: " + (cErr?.message ?? "") };
  }

  // Si el lead tenía servicio interesado, crear client_services con el monto
  if (lead.servicio_interesado) {
    const { error: csErr } = await supabase.from("client_services").insert({
      cliente_id: created.id,
      tipo: lead.servicio_interesado,
      ...gestionPackFields(lead.servicio_interesado),
      monto_mensual: lead.monto_estimado,
      moneda: lead.moneda ?? "ARS",
      fecha_inicio: new Date().toISOString().slice(0, 10),
      activo: true,
    });
    if (csErr) {
      // No bloquea: el cliente ya existe. Avisamos solo en logs.
      console.warn("convertLeadToClient: client_services insert failed", csErr);
    }
  }

  // Marcar lead como ganado y vincular al cliente
  await supabase
    .from("leads")
    .update({ stage: "ganado", ganado_cliente_id: created.id })
    .eq("id", leadId);

  revalidatePath("/comercial");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${created.id}`);

  return { ok: true, clientId: created.id };
}

/**
 * Genera una PROPUESTA a partir de un lead: crea el cliente en estado
 * "propuesta" (NO cuenta en Finanzas, Sueldos ni en la lista de activos) para
 * poder armar y enviar la carta acuerdo antes de que el cliente pague. Si paga,
 * se activa desde la ficha (Activar cliente) y recién ahí arranca su primer mes
 * y la comisión de cierre. Si no paga, no ensucia nada.
 *
 * El comercial asignado al lead queda registrado como "cerrado por" para que la
 * comisión del primer mes se calcule sola al activarlo.
 */
export async function createProposalFromLead(leadId: string) {
  const { supabase } = await ctx();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { error: leadErr?.message ?? "Lead no encontrado" };
  }
  if (lead.ganado_cliente_id) {
    return {
      error: "Este lead ya tiene una ficha creada: " + lead.ganado_cliente_id,
    };
  }

  const clientName = (lead.empresa?.trim() || lead.nombre?.trim() || "Cliente").slice(
    0,
    120
  );

  const { data: created, error: cErr } = await supabase
    .from("clients")
    .insert({
      nombre: clientName,
      estado: "propuesta",
      contacto_nombre: lead.empresa ? lead.nombre : null,
      contacto_email: lead.email,
      contacto_telefono: lead.telefono,
      monto_mensual: lead.monto_estimado,
      notas: lead.notas,
      cerrado_por_id: lead.asignado_a_id,
      // La fecha de inicio (primer mes) se setea al ACTIVAR, no ahora.
      fecha_inicio: null,
    })
    .select("id")
    .single();
  if (cErr || !created) {
    return { error: "No se pudo crear la propuesta: " + (cErr?.message ?? "") };
  }

  // Si el lead tenía servicio interesado, crear client_services con el monto.
  if (lead.servicio_interesado) {
    const { error: csErr } = await supabase.from("client_services").insert({
      cliente_id: created.id,
      tipo: lead.servicio_interesado,
      ...gestionPackFields(lead.servicio_interesado),
      monto_mensual: lead.monto_estimado,
      moneda: lead.moneda ?? "ARS",
      fecha_inicio: null,
      activo: true,
    });
    if (csErr) {
      console.warn("createProposalFromLead: client_services insert failed", csErr);
    }
  }

  // Vincular la ficha al lead (sin marcarlo "ganado" todavía: aún no pagó).
  await supabase
    .from("leads")
    .update({ ganado_cliente_id: created.id })
    .eq("id", leadId);

  revalidatePath("/comercial");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${created.id}`);

  return { ok: true, clientId: created.id };
}

export interface DirectProposalInput {
  nombre: string; // empresa o nombre del cliente
  contacto_nombre: string | null;
  email: string | null;
  telefono: string | null;
  servicio: string | null; // slug/tipo de servicio interesado (opcional)
  pack: string | null; // pack de gestión de redes (si el servicio es gestión)
  monto_estimado: number | null;
  cerrado_por_id: string | null;
  coordinador_id: string | null; // coordinador/a del servicio (asigna puestos después)
}

/**
 * Crea una PROPUESTA directo, sin pasar por el pipeline de leads: cargás los
 * datos del prospecto que ya te los pasó y queda lista para armar la carta
 * acuerdo. Mismo estado "propuesta" (no cuenta hasta activar al pagar).
 */
export async function createDirectProposal(input: DirectProposalInput) {
  const me = await requireUser();
  if (!canComercial(me)) return { error: "No tenés permiso para crear propuestas." };
  const clientName = (input.nombre?.trim() || input.contacto_nombre?.trim() || "").slice(0, 120);
  if (!clientName) return { error: "Poné al menos el nombre del cliente." };

  // Usamos el cliente admin: la RLS de clients solo deja escribir a staff
  // (admin/coordinador), pero comercial/prospecting también deben poder crear
  // propuestas. El permiso ya lo validamos arriba con canComercial.
  const admin = createAdmin();
  const { data: created, error: cErr } = await admin
    .from("clients")
    .insert({
      nombre: clientName,
      estado: "propuesta",
      contacto_nombre: input.contacto_nombre?.trim() || null,
      contacto_email: input.email?.trim() || null,
      contacto_telefono: input.telefono?.trim() || null,
      monto_mensual: input.monto_estimado,
      cerrado_por_id: input.cerrado_por_id || me.id,
      coordinador_id: input.coordinador_id || null,
      fecha_inicio: null,
    })
    .select("id")
    .single();
  if (cErr || !created) {
    return { error: "No se pudo crear la propuesta: " + (cErr?.message ?? "") };
  }

  if (input.servicio) {
    const { error: csErr } = await admin.from("client_services").insert({
      cliente_id: created.id,
      tipo: input.servicio,
      ...gestionPackFields(input.servicio, input.pack),
      monto_mensual: input.monto_estimado,
      moneda: "ARS",
      fecha_inicio: null,
      activo: true,
    });
    if (csErr) console.warn("createDirectProposal: service insert failed", csErr);
  }

  revalidatePath("/comercial");
  revalidatePath("/clientes");
  return { ok: true, clientId: created.id };
}
