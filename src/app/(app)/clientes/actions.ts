"use server";

import { revalidatePath } from "next/cache";
import { invalidateClientsCache } from "@/lib/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

/** Servicio cargado junto con el alta del cliente. */
export interface NewClientServiceInput {
  tipo: string;
  pack: string | null;
  monto_mensual: number | null;
  moneda: string;
  pack_detalle: Record<string, number>;
  responsables: string[];
  /** 'mensual' (recurrente) | 'unico' (cobro de única vez). */
  facturacion: "mensual" | "unico";
}

export interface ClientInput {
  nombre: string;
  rubro: string | null;
  pack: string;
  estado: string;
  fecha_inicio: string | null;
  monto_mensual: number | null;
  calendario_url: string | null;
  drive_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  web_url: string | null;
  datos_facturacion: string | null;
  notion_url: string | null;
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
}

function clean(input: ClientInput) {
  return {
    nombre: input.nombre.trim(),
    rubro: input.rubro?.trim() || null,
    pack: input.pack,
    estado: input.estado,
    fecha_inicio: input.fecha_inicio || null,
    monto_mensual:
      input.monto_mensual === null || Number.isNaN(input.monto_mensual)
        ? null
        : input.monto_mensual,
    calendario_url: input.calendario_url?.trim() || null,
    drive_url: input.drive_url?.trim() || null,
    instagram_url: input.instagram_url?.trim() || null,
    facebook_url: input.facebook_url?.trim() || null,
    web_url: input.web_url?.trim() || null,
    datos_facturacion: input.datos_facturacion?.trim() || null,
    notion_url: input.notion_url?.trim() || null,
    contacto_nombre: input.contacto_nombre?.trim() || null,
    contacto_dni_cuit: input.contacto_dni_cuit?.trim() || null,
    contacto_domicilio: input.contacto_domicilio?.trim() || null,
    contacto_email: input.contacto_email?.trim() || null,
    contacto_telefono: input.contacto_telefono?.trim() || null,
    notas: input.notas?.trim() || null,
    cm_id: input.cm_id || null,
    disenador_id: input.disenador_id || null,
    audiovisual_id: input.audiovisual_id || null,
    media_buyer_id: input.media_buyer_id || null,
  };
}

export async function createClientRow(
  input: ClientInput,
  services?: NewClientServiceInput[]
) {
  const { supabase, userId } = await ctx();
  const cleaned = clean(input);
  const { data, error } = await supabase
    .from("clients")
    .insert(cleaned)
    .select("id")
    .single();
  if (error) return { error: error.message };

  const clienteId = data.id as string;

  // Servicios cargados desde el alta (opcional).
  const validServices = (services ?? []).filter((s) => s.tipo);
  if (validServices.length > 0) {
    const rows = validServices.map((s) => ({
      cliente_id: clienteId,
      tipo: s.tipo,
      pack: s.tipo === "gestion_redes" ? s.pack || null : null,
      monto_mensual:
        s.monto_mensual === null || Number.isNaN(s.monto_mensual)
          ? null
          : s.monto_mensual,
      moneda: s.moneda || "ARS",
      pack_detalle: s.pack_detalle ?? {},
      facturacion: s.facturacion === "unico" ? "unico" : "mensual",
      fecha_inicio: cleaned.fecha_inicio,
      activo: true,
      responsables: Array.from(new Set((s.responsables ?? []).filter(Boolean))),
    }));
    const { error: svcErr } = await supabase.from("client_services").insert(rows);
    if (svcErr) {
      // El cliente ya se creó; informamos el problema con los servicios.
      revalidatePath("/clientes");
      invalidateClientsCache();
      return {
        ok: true,
        id: clienteId,
        serviceWarning: `Cliente creado, pero hubo un problema cargando los servicios: ${svcErr.message}`,
      };
    }

    // Notificar a los responsables de cada servicio (dedup por persona+servicio).
    await notifyClientServiceAssignees(clienteId, input.nombre, validServices, userId);
  }

  revalidatePath("/clientes");
  invalidateClientsCache();
  return { ok: true, id: clienteId };
}

/** Notifica a las personas asignadas a los servicios cargados en el alta. */
async function notifyClientServiceAssignees(
  clienteId: string,
  nombreCliente: string,
  services: NewClientServiceInput[],
  actorId: string
) {
  const admin = createAdmin();
  const link = `/clientes/${clienteId}`;
  const rows: {
    user_id: string;
    tipo: string;
    mensaje: string;
    link: string;
    task_id: null;
  }[] = [];

  for (const s of services) {
    const servicioLabel = SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo;
    const destinatarios = Array.from(
      new Set((s.responsables ?? []).filter(Boolean))
    ).filter((id) => id !== actorId);
    for (const uid of destinatarios) {
      rows.push({
        user_id: uid,
        tipo: "asignacion",
        mensaje: `📌 Te asignaron a ${servicioLabel} de ${nombreCliente}`,
        link,
        task_id: null,
      });
    }
  }

  if (rows.length > 0) {
    await admin.from("notifications").insert(rows);
  }
}

export async function updateClientRow(id: string, input: ClientInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("clients").update(clean(input)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  invalidateClientsCache();
  return { ok: true };
}

export async function deleteClientRow(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  invalidateClientsCache();
  return { ok: true };
}

/**
 * Update genérico para los arrays jsonb del cliente
 * (links_custom, redes_sociales, credenciales).
 * Solo admite estos campos para evitar inyección.
 */
const ALLOWED_JSON_FIELDS = ["links_custom", "redes_sociales", "credenciales"] as const;

export async function updateClientJsonbArray(
  id: string,
  field: (typeof ALLOWED_JSON_FIELDS)[number],
  array: Record<string, string>[]
) {
  if (!ALLOWED_JSON_FIELDS.includes(field)) {
    return { error: "campo no permitido" };
  }
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("clients")
    .update({ [field]: array })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

/** Toggle entre activo/inactivo (las fechas las pone el trigger). */
export async function toggleClientStatus(id: string, currentStatus: string) {
  const { supabase } = await ctx();
  const next = currentStatus === "activo" ? "perdido" : "activo";
  const { error } = await supabase.from("clients").update({ estado: next }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, nuevo: next };
}
