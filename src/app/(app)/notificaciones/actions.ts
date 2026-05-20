"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markRead(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notificaciones");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllRead() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const { error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("user_id", user.id)
    .eq("leida", false);
  if (error) return { error: error.message };
  revalidatePath("/notificaciones");
  revalidatePath("/dashboard");
  return { ok: true };
}
