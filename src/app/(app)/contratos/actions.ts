"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export interface ContractInput {
  user_id: string;
  position_id?: string | null;
  rol_descripcion?: string | null;
  compensation_type: "comision" | "fee_fijo" | "por_entrega" | "mixto";
  compensation_detail?: string | null;
  monto_referencia?: number | null;
  moneda?: string;
  confidentiality?: boolean;
  cesion_derechos?: boolean;
  no_competencia?: boolean;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin?: string | null;
  estado?: "borrador" | "activo" | "pausado" | "finalizado";
  content_md?: string | null;
  notas?: string | null;
}

function validate(input: ContractInput): string | null {
  if (!input.user_id) return "Falta la persona del equipo";
  if (!input.fecha_inicio) return "Falta fecha de inicio";
  return null;
}

export async function createContract(input: ContractInput) {
  const err = validate(input);
  if (err) return { error: err };
  const me = await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("freelance_contracts")
    .insert({
      user_id: input.user_id,
      position_id: input.position_id || null,
      rol_descripcion: input.rol_descripcion?.trim() || null,
      compensation_type: input.compensation_type,
      compensation_detail: input.compensation_detail?.trim() || null,
      monto_referencia: input.monto_referencia ?? null,
      moneda: input.moneda || "ARS",
      confidentiality: input.confidentiality ?? true,
      cesion_derechos: input.cesion_derechos ?? true,
      no_competencia: input.no_competencia ?? false,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin || null,
      estado: input.estado || "borrador",
      content_md: input.content_md || null,
      notas: input.notas?.trim() || null,
      created_by: me.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Error al crear" };
  revalidatePath("/contratos");
  return { ok: true, id: data.id };
}

export async function updateContract(id: string, input: ContractInput) {
  const err = validate(input);
  if (err) return { error: err };
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const { error } = await supabase
    .from("freelance_contracts")
    .update({
      user_id: input.user_id,
      position_id: input.position_id || null,
      rol_descripcion: input.rol_descripcion?.trim() || null,
      compensation_type: input.compensation_type,
      compensation_detail: input.compensation_detail?.trim() || null,
      monto_referencia: input.monto_referencia ?? null,
      moneda: input.moneda || "ARS",
      confidentiality: input.confidentiality ?? true,
      cesion_derechos: input.cesion_derechos ?? true,
      no_competencia: input.no_competencia ?? false,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin || null,
      estado: input.estado || "borrador",
      content_md: input.content_md ?? null,
      notas: input.notas?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
  return { ok: true };
}

export async function deleteContract(id: string) {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();
  const { error } = await supabase
    .from("freelance_contracts")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contratos");
  return { ok: true };
}

export async function saveContractContent(id: string, content_md: string) {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();
  const { error } = await supabase
    .from("freelance_contracts")
    .update({ content_md })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/contratos/${id}`);
  return { ok: true };
}
