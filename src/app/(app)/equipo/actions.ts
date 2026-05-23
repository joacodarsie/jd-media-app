"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PositionTool } from "@/lib/types";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export interface PositionInput {
  nombre: string;
  area: string;
  descripcion: string | null;
  alcance_incluye: string | null;
  alcance_excluye: string | null;
  herramientas: PositionTool[];
  kpis: string | null;
  procesos: string | null;
  services: string[];
  pago_default_monto: number | null;
  pago_default_moneda: string | null;
  pago_default_frecuencia: string | null;
  pago_default_forma: string | null;
  pago_default_notas: string | null;
}

function clean(input: PositionInput) {
  return {
    nombre: input.nombre.trim(),
    area: input.area,
    descripcion: input.descripcion?.trim() || null,
    alcance_incluye: input.alcance_incluye?.trim() || null,
    alcance_excluye: input.alcance_excluye?.trim() || null,
    herramientas: input.herramientas ?? [],
    kpis: input.kpis?.trim() || null,
    procesos: input.procesos?.trim() || null,
    services: (input.services ?? []).filter(Boolean),
    pago_default_monto: input.pago_default_monto,
    pago_default_moneda: input.pago_default_moneda || "ARS",
    pago_default_frecuencia: input.pago_default_frecuencia || "mensual",
    pago_default_forma: input.pago_default_forma?.trim() || null,
    pago_default_notas: input.pago_default_notas?.trim() || null,
  };
}

export async function createPosition(input: PositionInput) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("positions")
    .insert(clean(input))
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return { ok: true, id: data.id };
}

export async function updatePosition(id: string, input: PositionInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("positions").update(clean(input)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  revalidatePath(`/equipo/${id}`);
  return { ok: true };
}

export async function deletePosition(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

export async function assignUserPosition(userId: string, positionId: string | null) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("users")
    .update({ position_id: positionId })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

export async function assignUserSecondaryPositions(
  userId: string,
  positionIds: string[]
) {
  const { supabase } = await ctx();
  const clean = Array.from(new Set(positionIds.filter(Boolean)));
  const { error } = await supabase
    .from("users")
    .update({ secondary_position_ids: clean })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  revalidatePath("/equipo/personas");
  return { ok: true };
}

export interface CompensationInput {
  user_id: string;
  monto: number | null;
  moneda: string | null;
  frecuencia: string | null;
  forma_pago: string | null;
  notas: string | null;
}

export async function upsertCompensation(input: CompensationInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("compensation").upsert(
    {
      user_id: input.user_id,
      monto: input.monto,
      moneda: input.moneda || "ARS",
      frecuencia: input.frecuencia || "mensual",
      forma_pago: input.forma_pago?.trim() || null,
      notas: input.notas?.trim() || null,
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  revalidatePath("/mi-perfil");
  return { ok: true };
}

export async function clearCompensation(userId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("compensation").delete().eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/equipo");
  revalidatePath("/mi-perfil");
  return { ok: true };
}
