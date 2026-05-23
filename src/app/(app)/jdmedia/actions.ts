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

export async function renameConversation(id: string, title: string) {
  const { supabase } = await ctx();
  const clean = (title ?? "").trim().slice(0, 120);
  if (!clean) return { error: "Título vacío." };
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: clean })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/jdmedia");
  revalidatePath(`/jdmedia/${id}`);
  return { ok: true };
}

export async function deleteConversation(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/jdmedia");
  return { ok: true };
}
