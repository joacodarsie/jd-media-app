"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DirectorIdea } from "@/lib/director/insight";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

/**
 * Crea una publicación en estado 'idea' a partir de una idea del Director,
 * y marca la idea como aplicada en el reporte.
 */
export async function applyDirectorIdea(reportId: string, ideaIndex: number) {
  const { supabase, userId } = await ctx();

  const { data: rep, error: repErr } = await supabase
    .from("director_reports")
    .select("cliente_id, ideas")
    .eq("id", reportId)
    .maybeSingle();
  if (repErr) return { error: repErr.message };
  if (!rep) return { error: "Reporte no encontrado." };

  const ideas = (Array.isArray(rep.ideas) ? rep.ideas : []) as DirectorIdea[];
  const idea = ideas[ideaIndex];
  if (!idea) return { error: "Idea no encontrada." };
  if (idea.applied_pub_id) return { error: "Esta idea ya fue agregada al calendario." };

  const { data: pub, error } = await supabase
    .from("publications")
    .insert({
      cliente_id: rep.cliente_id,
      titulo: idea.titulo,
      copy: idea.copy ?? null,
      red: idea.red || "instagram",
      tipo: idea.tipo || "post",
      estado: "idea",
      creado_por_id: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  ideas[ideaIndex] = { ...idea, applied_pub_id: pub.id };
  await supabase.from("director_reports").update({ ideas }).eq("id", reportId);

  revalidatePath("/director");
  revalidatePath("/contenidos");
  return { ok: true, pubId: pub.id as string };
}
