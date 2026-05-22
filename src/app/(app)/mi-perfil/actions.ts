"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** Guarda el WhatsApp del user logueado y su opt-in. */
export async function updateMyWhatsApp(phone: string | null, optin: boolean) {
  const me = await requireUser();
  const cleanPhone = phone?.trim() || null;
  // validación mínima: solo dígitos, +, -, espacios; 8 a 20 chars
  if (cleanPhone) {
    if (!/^[+\d\s\-()]{8,20}$/.test(cleanPhone)) {
      return { error: "Teléfono inválido. Ej: +54 9 351 555 5555" };
    }
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({
      whatsapp_phone: cleanPhone,
      whatsapp_optin: optin && !!cleanPhone,
    })
    .eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/mi-perfil");
  return { ok: true };
}
