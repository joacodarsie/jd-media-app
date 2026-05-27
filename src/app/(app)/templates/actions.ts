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

export const TEMPLATE_CATEGORIES = [
  "chat",
  "comercial",
  "onboarding",
  "copy",
  "otro",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  chat: "Chat interno",
  comercial: "Comercial / Leads",
  onboarding: "Onboarding cliente",
  copy: "Copy / Redes",
  otro: "Otro",
};

export interface TemplateInput {
  titulo: string;
  contenido: string;
  categoria: string;
  tags?: string[];
  scope?: "propio" | "global";
}

export async function createTemplate(input: TemplateInput) {
  const { supabase, userId } = await ctx();
  const titulo = input.titulo.trim();
  const contenido = input.contenido.trim();
  if (!titulo) return { error: "Falta el título." };
  if (!contenido) return { error: "Falta el contenido." };
  if (titulo.length > 80) return { error: "Título demasiado largo (max 80)." };

  const cat = TEMPLATE_CATEGORIES.includes(
    input.categoria as TemplateCategory
  )
    ? input.categoria
    : "otro";

  const { error } = await supabase.from("message_templates").insert({
    titulo,
    contenido,
    categoria: cat,
    tags: input.tags ?? [],
    scope: input.scope === "global" ? "global" : "propio",
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const { supabase } = await ctx();
  const titulo = input.titulo.trim();
  const contenido = input.contenido.trim();
  if (!titulo) return { error: "Falta el título." };
  if (!contenido) return { error: "Falta el contenido." };

  const cat = TEMPLATE_CATEGORIES.includes(
    input.categoria as TemplateCategory
  )
    ? input.categoria
    : "otro";

  const { error } = await supabase
    .from("message_templates")
    .update({
      titulo,
      contenido,
      categoria: cat,
      tags: input.tags ?? [],
      scope: input.scope === "global" ? "global" : "propio",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("message_templates")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}

/** Incrementa use_count y last_used_at. Llamar cuando el usuario "usa" el template. */
export async function bumpTemplateUse(id: string) {
  const { supabase } = await ctx();
  // Leer count actual + escribir
  const { data: row } = await supabase
    .from("message_templates")
    .select("use_count")
    .eq("id", id)
    .maybeSingle();
  const next = (row?.use_count ?? 0) + 1;
  const { error } = await supabase
    .from("message_templates")
    .update({ use_count: next, last_used_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
