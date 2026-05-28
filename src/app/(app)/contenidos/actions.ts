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
  descripcion: string | null;
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
  publicacion_url?: string | null;
  resubido_tiktok?: boolean;
}

function clean(input: PublicationInput) {
  return {
    cliente_id: input.cliente_id,
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
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
    publicacion_url: input.publicacion_url?.trim() || null,
    resubido_tiktok: input.resubido_tiktok ?? false,
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
    .select("id, cliente_id, task_id")
    .single();
  if (error) return { error: error.message };

  // El trigger jd_publication_autogen_task creó una tarea y la linkeó.
  // Traemos el nombre del asignado para mostrar feedback.
  let assignedName: string | null = null;
  let taskArea: string | null = null;
  if (data.task_id) {
    const { data: t } = await supabase
      .from("tasks")
      .select("area, asignado:users!tasks_asignado_a_id_fkey(nombre)")
      .eq("id", data.task_id)
      .maybeSingle();
    const asignado = (t as unknown as { asignado: { nombre: string } | null } | null)?.asignado;
    assignedName = asignado?.nombre ?? null;
    taskArea = (t as { area: string } | null)?.area ?? null;
  }

  invalidate(data.cliente_id);
  return {
    ok: true,
    id: data.id,
    task_id: data.task_id,
    assignedName,
    taskArea,
  };
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

/**
 * Cambia solo la fecha de publicación. Usado por el drag&drop del calendario.
 * date debe venir en YYYY-MM-DD (o null para "sin fecha").
 */
export async function updatePublicationDate(id: string, date: string | null) {
  const { supabase } = await ctx();
  let fechaIso: string | null = null;
  if (date) {
    // mantener la hora original si existía; sino mediodía Cordoba
    const { data: existing } = await supabase
      .from("publications")
      .select("fecha_publicacion")
      .eq("id", id)
      .maybeSingle();
    if (existing?.fecha_publicacion) {
      const prev = new Date(existing.fecha_publicacion);
      const hh = prev.getUTCHours();
      const mm = prev.getUTCMinutes();
      fechaIso = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;
    } else {
      // 12:00 hora Cordoba = 15:00 UTC
      fechaIso = `${date}T15:00:00.000Z`;
    }
  }
  const { data, error } = await supabase
    .from("publications")
    .update({ fecha_publicacion: fechaIso })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

/** Update parcial de los links por red de la publicación (cuando ya se publicó). */
export async function updatePublicationFinalFields(
  id: string,
  link_instagram: string | null,
  link_tiktok: string | null,
  link_facebook: string | null
) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .update({ link_instagram, link_tiktok, link_facebook })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

export async function setPublicationTiktokSubido(
  id: string,
  subido: boolean
) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .update({ tiktok_subido: subido })
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
