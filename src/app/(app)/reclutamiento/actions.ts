"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

async function ctx() {
  const me = await requireUser();
  if (!isStaff(me.rol)) throw new Error("Sin acceso.");
  return { me, admin: createAdmin() };
}

export interface SearchInput {
  titulo: string;
  area: string | null;
  perfil: string | null;
  ubicacion_pref: string | null;
}

export async function createSearch(
  input: SearchInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const { me, admin } = await ctx();
  if (!input.titulo.trim()) return { error: "Poné un título para la búsqueda." };
  const { data, error } = await admin
    .from("recruitment_searches")
    .insert({
      titulo: input.titulo.trim(),
      area: input.area,
      perfil: input.perfil?.trim() || null,
      ubicacion_pref: input.ubicacion_pref?.trim() || "Córdoba Capital",
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true, id: data.id as string };
}

export async function updateSearch(
  id: string,
  input: SearchInput
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin
    .from("recruitment_searches")
    .update({
      titulo: input.titulo.trim(),
      area: input.area,
      perfil: input.perfil?.trim() || null,
      ubicacion_pref: input.ubicacion_pref?.trim() || "Córdoba Capital",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  revalidatePath(`/reclutamiento/${id}`);
  return { ok: true };
}

export async function setSearchEstado(
  id: string,
  estado: "abierta" | "cerrada"
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin
    .from("recruitment_searches")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  revalidatePath(`/reclutamiento/${id}`);
  return { ok: true };
}

export async function deleteSearch(id: string): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin.from("recruitment_searches").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true };
}

export async function deleteCandidate(
  id: string,
  searchId: string
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin.from("recruitment_candidates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/reclutamiento/${searchId}`);
  return { ok: true };
}
