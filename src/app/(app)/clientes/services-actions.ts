"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

// Solo un administrador puede crear/editar/eliminar servicios de un cliente.
async function ctx() {
  const me = await requireUser();
  if (me.rol !== "admin") {
    throw new Error("Solo un administrador puede modificar los servicios del cliente.");
  }
  const supabase = createClient();
  return { supabase, userId: me.id };
}

export interface ServiceInput {
  cliente_id: string;
  tipo: string;
  pack: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  monto_mensual: number | null;
  moneda: string;
  pack_detalle: Record<string, number | string>;
  notas: string | null;
  activo: boolean;
  /** 'mensual' (recurrente) | 'unico' (cobro de única vez). */
  facturacion: "mensual" | "unico";
  /** Personas que llevan este servicio (equipo por servicio). */
  responsables: string[];
  /** Costo de entrega (servicios no por-pieza): % del monto (0–1) o monto fijo. */
  costo_pct?: number | null;
  costo_override?: number | null;
  /** Persona a la que se le paga el costo de entrega. */
  costo_override_user?: string | null;
}

function clean(input: ServiceInput) {
  const base = {
    cliente_id: input.cliente_id,
    tipo: input.tipo,
    pack: input.pack?.trim() || null,
    fecha_inicio: input.fecha_inicio || null,
    // Un servicio activo no tiene fecha de baja; al desactivarlo, si no se cargó
    // una, la completa updateService con la fecha del día (para el MRR histórico).
    fecha_fin: input.activo ? null : input.fecha_fin || null,
    monto_mensual:
      input.monto_mensual === null || Number.isNaN(input.monto_mensual)
        ? null
        : input.monto_mensual,
    moneda: input.moneda || "ARS",
    pack_detalle: input.pack_detalle ?? {},
    facturacion: input.facturacion === "unico" ? "unico" : "mensual",
    notas: input.notas?.trim() || null,
    activo: input.activo,
    responsables: Array.isArray(input.responsables)
      ? Array.from(new Set(input.responsables.filter(Boolean)))
      : [],
  };

  // Los campos de costo de entrega SOLO se tocan para servicios que no son de
  // gestión de redes. En gestión, `costo_override` es el acuerdo fijo (ej. Luz)
  // y se preserva: no lo incluimos en el payload para no pisarlo.
  if (input.tipo === "gestion_redes") return base;

  const override =
    input.costo_override != null && !Number.isNaN(input.costo_override)
      ? input.costo_override
      : null;
  const pct =
    override == null && input.costo_pct != null && !Number.isNaN(input.costo_pct)
      ? input.costo_pct
      : null;
  return {
    ...base,
    costo_override: override,
    costo_pct: pct,
    costo_override_user: override != null || pct != null ? input.costo_override_user || null : null,
  };
}

/**
 * Notifica a las personas asignadas a un servicio que se les asignó. Excluye a
 * quien hace la acción. Usa admin para sortear RLS (notifica a otros usuarios).
 */
async function notifyResponsables(
  clienteId: string,
  tipo: string,
  responsables: string[],
  actorId: string
) {
  const destinatarios = Array.from(new Set(responsables.filter(Boolean))).filter(
    (id) => id !== actorId
  );
  if (destinatarios.length === 0) return;

  const admin = createAdmin();
  const { data: client } = await admin
    .from("clients")
    .select("nombre")
    .eq("id", clienteId)
    .maybeSingle();

  const nombreCliente = (client as { nombre?: string } | null)?.nombre ?? "un cliente";
  const servicioLabel = SERVICE_TYPE_LABEL[tipo] ?? tipo;
  const mensaje = `📌 Te asignaron a ${servicioLabel} de ${nombreCliente}`;
  const link = `/clientes/${clienteId}`;

  await admin.from("notifications").insert(
    destinatarios.map((uid) => ({
      user_id: uid,
      tipo: "asignacion",
      mensaje,
      link,
      task_id: null,
    }))
  );
}

function invalidate(clienteId: string) {
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/finanzas");
}

export async function createService(input: ServiceInput) {
  const { supabase, userId } = await ctx();
  const { data, error } = await supabase
    .from("client_services")
    .insert(clean(input))
    .select("id")
    .single();
  if (error) return { error: error.message };
  await notifyResponsables(input.cliente_id, input.tipo, input.responsables, userId);
  invalidate(input.cliente_id);
  return { ok: true, id: data.id };
}

export async function updateService(id: string, input: ServiceInput) {
  const { supabase, userId } = await ctx();

  // Responsables + estado previos, para notificar solo a los recién agregados
  // y para detectar la baja (activo true→false).
  const { data: prev } = await supabase
    .from("client_services")
    .select("responsables, activo")
    .eq("id", id)
    .maybeSingle();
  const prevTyped = prev as { responsables?: string[]; activo?: boolean } | null;
  const prevResp = new Set((prevTyped?.responsables ?? []).filter(Boolean));

  const payload = clean(input);
  // Si se está dando de baja y no se cargó fecha de fin, la registramos hoy
  // para que el MRR histórico pueda descontar la cuenta a partir de acá.
  if (prevTyped?.activo === true && !input.activo && !payload.fecha_fin) {
    payload.fecha_fin = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("client_services")
    .update(payload)
    .eq("id", id);
  if (error) return { error: error.message };

  const nuevos = (input.responsables ?? []).filter((r) => r && !prevResp.has(r));
  await notifyResponsables(input.cliente_id, input.tipo, nuevos, userId);

  invalidate(input.cliente_id);
  return { ok: true };
}

export async function deleteService(id: string, clienteId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("client_services").delete().eq("id", id);
  if (error) return { error: error.message };
  invalidate(clienteId);
  return { ok: true };
}
