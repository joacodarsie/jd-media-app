"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, isStaffUser } from "@/lib/auth";
import { runDirectorWeekly } from "@/lib/director/run";
import { runMonthStartReports } from "@/lib/director/monthly";
import type { DirectorIdea } from "@/lib/director/insight";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

/** Dispara el parte semanal del Director ahora (solo staff). Sin notificaciones. */
export async function runWeeklyNow() {
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo admin/coordinación puede generarlo." };
  const admin = createAdmin();
  const res = await runDirectorWeekly(admin, new Date(), false);
  revalidatePath("/director");
  if (!res.ok) return { error: (res as { error?: string }).error ?? "Error generando" };
  return { ok: true, analyzed: (res as { analyzed?: number }).analyzed ?? 0 };
}

/** Genera/prepara los reportes mensuales del mes anterior ahora (solo staff). */
export async function runMonthlyNow() {
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo admin/coordinación puede generarlo." };
  const admin = createAdmin();
  try {
    const res = await runMonthStartReports(admin, new Date());
    revalidatePath("/director");
    return { ok: true, prepared: (res as { prepared?: number }).prepared ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error generando reportes" };
  }
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
