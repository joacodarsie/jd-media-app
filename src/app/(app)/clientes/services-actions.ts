"use server";

import { revalidatePath } from "next/cache";
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
  /** Personas que llevan este servicio (equipo por servicio). */
  responsables: string[];
}

function clean(input: ServiceInput) {
  return {
    cliente_id: input.cliente_id,
    tipo: input.tipo,
    pack: input.pack?.trim() || null,
    fecha_inicio: input.fecha_inicio || null,
    fecha_fin: input.fecha_fin || null,
    monto_mensual:
      input.monto_mensual === null || Number.isNaN(input.monto_mensual)
        ? null
        : input.monto_mensual,
    moneda: input.moneda || "ARS",
    pack_detalle: input.pack_detalle ?? {},
    notas: input.notas?.trim() || null,
    activo: input.activo,
    responsables: Array.isArray(input.responsables)
      ? Array.from(new Set(input.responsables.filter(Boolean)))
      : [],
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

  // Responsables previos, para notificar solo a los recién agregados.
  const { data: prev } = await supabase
    .from("client_services")
    .select("responsables")
    .eq("id", id)
    .maybeSingle();
  const prevResp = new Set(
    ((prev as { responsables?: string[] } | null)?.responsables ?? []).filter(Boolean)
  );

  const { error } = await supabase
    .from("client_services")
    .update(clean(input))
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
