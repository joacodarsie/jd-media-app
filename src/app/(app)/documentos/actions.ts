"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isStaff } from "@/lib/auth";

export type DocumentCategory =
  | "onboarding"
  | "manual_marca"
  | "procesos"
  | "contratos"
  | "plantillas"
  | "propuesta"
  | "otros";

async function ctx(requireStaff = true) {
  const me = await requireUser();
  if (requireStaff && !isStaff(me.rol)) throw new Error("Solo staff puede modificar documentos.");
  const supabase = createClient();
  return { supabase, me };
}

export interface DocumentInput {
  titulo: string;
  descripcion?: string | null;
  categoria: DocumentCategory;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  cliente_id?: string | null;
  usar_en_ia?: boolean;
}

export async function createDocument(input: DocumentInput) {
  const { supabase, me } = await ctx();
  const { error } = await supabase.from("documents").insert({
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    categoria: input.categoria,
    storage_path: input.storage_path,
    file_name: input.file_name,
    file_size: input.file_size,
    mime_type: input.mime_type,
    subido_por_id: me.id,
    cliente_id: input.cliente_id ?? null,
    usar_en_ia: input.usar_en_ia ?? true,
  });
  if (error) return { error: error.message };
  revalidatePath("/documentos");
  if (input.cliente_id) revalidatePath(`/clientes/${input.cliente_id}`);
  return { ok: true };
}

export async function updateDocument(
  id: string,
  patch: {
    titulo?: string;
    descripcion?: string | null;
    categoria?: DocumentCategory;
    usar_en_ia?: boolean;
  }
) {
  const { supabase } = await ctx();
  const payload: Record<string, unknown> = {};
  if (patch.titulo !== undefined) payload.titulo = patch.titulo.trim();
  if (patch.descripcion !== undefined) payload.descripcion = patch.descripcion?.trim() || null;
  if (patch.categoria !== undefined) payload.categoria = patch.categoria;
  if (patch.usar_en_ia !== undefined) payload.usar_en_ia = patch.usar_en_ia;
  const { data, error } = await supabase
    .from("documents")
    .update(payload)
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/documentos");
  if (data?.cliente_id) revalidatePath(`/clientes/${data.cliente_id}`);
  return { ok: true };
}

export async function deleteDocument(id: string) {
  const { supabase } = await ctx();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (doc?.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/documentos");
  if (doc?.cliente_id) revalidatePath(`/clientes/${doc.cliente_id}`);
  return { ok: true };
}

/** Genera una URL firmada de 5 minutos para descargar el archivo. */
export async function getDocumentSignedUrl(id: string) {
  await requireUser(); // cualquier user autenticado puede ver
  const supabase = createClient();
  const { data: doc, error: dErr } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (dErr || !doc) return { error: "no encontrado" };
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300);
  if (error || !data) return { error: error?.message ?? "no se pudo firmar" };
  return { ok: true, url: data.signedUrl, file_name: doc.file_name };
}
