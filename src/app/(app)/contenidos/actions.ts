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

export interface PublicationInput {
  cliente_id: string;
  titulo: string;
  copy: string | null;
  guion: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  hashtags: string | null;
  asset_url: string | null;
  referencia_url: string | null;
  audiovisual_id: string | null;
  task_id: string | null;
  notas_revision?: string | null;
  estado?: string;
}

function clean(input: PublicationInput) {
  return {
    cliente_id: input.cliente_id,
    titulo: input.titulo.trim(),
    copy: input.copy?.trim() || null,
    guion: input.guion?.trim() || null,
    red: input.red,
    tipo: input.tipo,
    fecha_publicacion: input.fecha_publicacion || null,
    hashtags: input.hashtags?.trim() || null,
    asset_url: input.asset_url?.trim() || null,
    referencia_url: input.referencia_url?.trim() || null,
    audiovisual_id: input.audiovisual_id || null,
    task_id: input.task_id || null,
    notas_revision: input.notas_revision?.trim() || null,
  };
}

function invalidate(clienteId?: string | null) {
  revalidatePath("/contenidos");
  if (clienteId) revalidatePath(`/clientes/${clienteId}/calendario`);
}

export async function createPublication(input: PublicationInput) {
  const { supabase, userId } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .insert({ ...clean(input), creado_por_id: userId })
    .select("id, cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data.cliente_id);
  return { ok: true, id: data.id };
}

export async function updatePublication(id: string, input: PublicationInput) {
  const { supabase } = await ctx();
  const payload: Record<string, unknown> = clean(input);
  if (input.estado) payload.estado = input.estado;
  const { data, error } = await supabase
    .from("publications")
    .update(payload)
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

export async function changePublicationStatus(id: string, estado: string, notas?: string) {
  const { supabase } = await ctx();
  const patch: Record<string, unknown> = { estado };
  if (notas !== undefined) patch.notas_revision = notas?.trim() || null;
  const { data, error } = await supabase
    .from("publications")
    .update(patch)
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

export async function deletePublication(id: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .delete()
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}
