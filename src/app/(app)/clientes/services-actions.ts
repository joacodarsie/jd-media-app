"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  };
}

function invalidate(clienteId: string) {
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/finanzas");
}

export async function createService(input: ServiceInput) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("client_services")
    .insert(clean(input))
    .select("id")
    .single();
  if (error) return { error: error.message };
  invalidate(input.cliente_id);
  return { ok: true, id: data.id };
}

export async function updateService(id: string, input: ServiceInput) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("client_services")
    .update(clean(input))
    .eq("id", id);
  if (error) return { error: error.message };
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
