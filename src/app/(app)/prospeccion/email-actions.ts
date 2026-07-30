"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { programarEnvios, runColdEmailBatch } from "@/lib/email/cold-sender";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

async function ensureComercial(): Promise<string | null> {
  const me = await requireUser();
  return userInRoles(me, ROLES_OK)
    ? null
    : "No tenés acceso a prospección.";
}

/** Arma la cola de envíos de una campaña (no manda nada todavía). */
export async function programarEnviosDeCampana(campaignId: string, asunto?: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const res = await programarEnvios({ campaignId, asuntoPlantilla: asunto });
  revalidatePath("/prospeccion/email");
  return res;
}

/**
 * Manda el lote de ahora mismo sin esperar al cron. Sirve para la primera
 * corrida (y para probar): respeta el mismo tope diario con warm-up.
 */
export async function enviarLoteAhora() {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const res = await runColdEmailBatch();
  revalidatePath("/prospeccion/email");
  return res;
}

/** Saca de la cola los envíos pendientes de una campaña (por si se arrepiente). */
export async function cancelarPendientes(campaignId: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const { error, count } = await createAdmin()
    .from("cold_email_sends")
    .delete({ count: "exact" })
    .eq("campaign_id", campaignId)
    .eq("estado", "pendiente");
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/email");
  return { cancelados: count ?? 0 };
}

/** Guarda la oferta y los links que van al final de todos los mails. */
export async function guardarCierre(input: {
  oferta: string;
  codigo: string;
  web: string;
  instagram: string;
  whatsapp: string;
}) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const limpio = (v: string) => v.trim().slice(0, 200) || null;
  const { error } = await createAdmin()
    .from("cold_email_settings")
    .upsert(
      {
        id: true,
        oferta: limpio(input.oferta),
        codigo: limpio(input.codigo),
        web: limpio(input.web),
        instagram: limpio(input.instagram),
        whatsapp: limpio(input.whatsapp),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) {
    if ((error as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0144." };
    return { error: error.message };
  }
  revalidatePath("/prospeccion/email");
  return { ok: true as const };
}

/** Agrega una dirección a la lista de supresión a mano. */
export async function agregarBaja(email: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const limpio = email.trim().toLowerCase();
  if (!limpio.includes("@")) return { error: "No parece un email." };
  const { error } = await createAdmin()
    .from("cold_email_optouts")
    .upsert({ email: limpio, motivo: "cargado a mano" }, { onConflict: "email" });
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/email");
  return { ok: true as const };
}
