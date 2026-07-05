"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * Guarda los overrides de cláusulas de la carta acuerdo (solo admin). Recibe
 * únicamente las cláusulas modificadas (distintas del default); las vacías se
 * descartan para que vuelvan a usar el texto por defecto.
 */
export async function saveContractClauses(overrides: Record<string, string>) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v && v.trim()) clean[k] = v.trim();
  }
  const { error } = await admin
    .from("agency_settings")
    .upsert({ id: 1, contract_clauses: clean });
  if (error) return { error: error.message };
  revalidatePath("/carta-plantilla");
  return { ok: true };
}
