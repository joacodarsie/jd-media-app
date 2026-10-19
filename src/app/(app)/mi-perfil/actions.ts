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

/** La foto de perfil del user logueado (18/10/2026). Tiene que ser de nuestro storage. */
export async function guardarMiFoto(url: string | null) {
  const me = await requireUser();
  const limpio = url?.trim() || null;
  if (limpio && !limpio.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)) {
    return { error: "La foto tiene que subirse desde acá." };
  }
  const { error } = await createClient().from("users").update({ avatar_url: limpio }).eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/mi-perfil");
  revalidatePath("/equipo");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Los datos personales y de facturación del user logueado (19/10/2026, 0209):
 * nombre completo, teléfono, DNI/CUIT, condición fiscal y domicilio.
 */
export async function updateMisDatos(input: {
  nombre: string;
  telefono: string | null;
  dniCuit: string | null;
  condicionFiscal: string | null;
  domicilio: string | null;
}) {
  const me = await requireUser();
  const clean = (s: string | null) => s?.trim() || null;
  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  if (nombre.split(" ").length < 2) return { error: "Poné tu nombre y apellido." };
  const tel = clean(input.telefono);
  if (tel && !/^[+\d\s\-()]{8,20}$/.test(tel)) return { error: "Teléfono inválido. Ej: +54 9 351 555 5555" };
  const doc = clean(input.dniCuit);
  if (doc && !/^[\d.\-\s]{7,15}$/.test(doc)) return { error: "El DNI o CUIT tiene que tener solo números (y guiones)." };
  const condiciones = ["monotributo", "responsable_inscripto", "relacion_dependencia", "ninguna"];
  const cond = clean(input.condicionFiscal);
  if (cond && !condiciones.includes(cond)) return { error: "Condición fiscal inválida." };
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ nombre, telefono: tel, dni_cuit: doc, condicion_fiscal: cond, domicilio: clean(input.domicilio)?.slice(0, 200) ?? null })
    .eq("id", me.id);
  if (error) return { error: /condicion_fiscal|domicilio/.test(error.message) ? "Falta aplicar la migración 0209." : error.message };
  revalidatePath("/mi-perfil");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** «Ya tengo anotados mi mail y mi contraseña» (19/10/2026, 0209). */
export async function confirmarMiAcceso() {
  const me = await requireUser();
  const supabase = createClient();
  const { error } = await supabase.from("users").update({ acceso_confirmado_at: new Date().toISOString() }).eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/mi-perfil");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
