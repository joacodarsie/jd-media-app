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
