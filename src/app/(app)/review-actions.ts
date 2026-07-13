"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/** Aprueba una feature "sin testear": el banner amarillo desaparece de esa ruta. */
export async function approveReviewFlag(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin
    .from("review_flags")
    .update({ approved_at: new Date().toISOString(), approved_by: me.id })
    .eq("id", id)
    .is("approved_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
