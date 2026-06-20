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

/** Guarda los datos bancarios del user logueado (para cobrar su sueldo). */
export async function updateMyBankDetails(input: {
  alias: string | null;
  cbu: string | null;
  titular: string | null;
}) {
  const me = await requireUser();
  const clean = (s: string | null) => {
    const v = s?.trim();
    return v ? v : null;
  };
  const cbu = clean(input.cbu);
  if (cbu && !/^\d{22}$/.test(cbu.replace(/\s/g, ""))) {
    return { error: "El CBU debe tener 22 dígitos." };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({
      alias_cbu: clean(input.alias),
      cbu: cbu ? cbu.replace(/\s/g, "") : null,
      titular_cuenta: clean(input.titular),
    })
    .eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/mi-perfil");
  return { ok: true };
}
