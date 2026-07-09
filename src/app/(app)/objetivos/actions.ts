"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/objetivos";
type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export interface ObjectiveIdea {
  id: string;
  texto: string;
  done: boolean;
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Crea un objetivo. area = null → objetivo general de la agencia. */
export async function createObjective(input: {
  area: string | null;
  titulo: string;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole(["admin", "coordinador"]);
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: "Escribí un título." };

  const admin = createAdmin();
  // Orden = al final del grupo (mismo área; null = general).
  const q = admin.from("agency_objectives").select("orden");
  const { data: last } = await (input.area === null
    ? q.is("area", null)
    : q.eq("area", input.area)
  )
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("agency_objectives")
    .insert({
      area: input.area,
      titulo,
      ideas: [],
      orden: ((last as { orden?: number } | null)?.orden ?? 0) + 1,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, data: { id: data.id } };
}

export async function updateObjective(input: {
  id: string;
  titulo?: string;
  detalle?: string | null;
  estado?: "activo" | "logrado" | "pausado";
}): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const patch: Record<string, unknown> = {};
  if (input.titulo !== undefined) {
    const t = input.titulo.trim();
    if (!t) return { ok: false, error: "El título no puede quedar vacío." };
    patch.titulo = t;
  }
  if (input.detalle !== undefined) patch.detalle = input.detalle?.trim() || null;
  if (input.estado !== undefined) patch.estado = input.estado;
  if (Object.keys(patch).length === 0) return { ok: true };

  const admin = createAdmin();
  const { error } = await admin.from("agency_objectives").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteObjective(id: string): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { error } = await admin.from("agency_objectives").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Helpers de ideas (viven en el jsonb del objetivo). */
async function mutateIdeas(
  id: string,
  fn: (ideas: ObjectiveIdea[]) => ObjectiveIdea[]
): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { data: row, error: fErr } = await admin
    .from("agency_objectives")
    .select("ideas")
    .eq("id", id)
    .maybeSingle();
  if (fErr || !row) return { ok: false, error: "Objetivo no encontrado." };
  const current = Array.isArray(row.ideas) ? (row.ideas as ObjectiveIdea[]) : [];
  const next = fn(current);
  const { error } = await admin.from("agency_objectives").update({ ideas: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function addIdea(id: string, texto: string): Promise<Result> {
  const t = texto.trim();
  if (!t) return { ok: false, error: "Escribí la idea." };
  return mutateIdeas(id, (ideas) => [...ideas, { id: newId(), texto: t, done: false }]);
}

export async function toggleIdea(id: string, ideaId: string): Promise<Result> {
  return mutateIdeas(id, (ideas) =>
    ideas.map((i) => (i.id === ideaId ? { ...i, done: !i.done } : i))
  );
}

export async function removeIdea(id: string, ideaId: string): Promise<Result> {
  return mutateIdeas(id, (ideas) => ideas.filter((i) => i.id !== ideaId));
}
