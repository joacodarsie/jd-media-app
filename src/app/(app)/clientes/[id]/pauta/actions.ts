"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

export type AdsStepKey =
  | "accesos_fb_at"
  | "pagina_fb_at"
  | "socio_business_at"
  | "ads_manager_at"
  | "su_adaccount_at"
  | "su_pagina_at"
  | "su_ig_at"
  | "dolar_app_at"
  | "tarjeta_vinculada_at"
  | "campanas_definidas_at"
  | "campanas_publicadas_at";

const VALID_STEPS: AdsStepKey[] = [
  "accesos_fb_at",
  "pagina_fb_at",
  "socio_business_at",
  "ads_manager_at",
  "su_adaccount_at",
  "su_pagina_at",
  "su_ig_at",
  "dolar_app_at",
  "tarjeta_vinculada_at",
  "campanas_definidas_at",
  "campanas_publicadas_at",
];

export async function toggleAdsStep(clientId: string, step: AdsStepKey, done: boolean) {
  await requireUser();
  if (!VALID_STEPS.includes(step)) return { error: "Paso inválido" };
  const admin = createAdmin();
  const value = done ? new Date().toISOString() : null;
  const { error } = await admin
    .from("client_ads_onboarding")
    .upsert({ cliente_id: clientId, [step]: value }, { onConflict: "cliente_id" });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/pauta`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Guarda el ID de la cuenta publicitaria de Meta (act_XXXX) del cliente. Es el
 * mismo dato que usa la sección Paid Media para traer las métricas vía Marketing
 * API: cargándolo acá, Guille deja conectada la cuenta desde el onboarding.
 */
export async function saveMetaAdAccountId(clientId: string, adAccountId: string) {
  await requireUser();
  const admin = createAdmin();
  const value = adAccountId.trim() || null;
  const { error } = await admin
    .from("client_ads_onboarding")
    .upsert(
      { cliente_id: clientId, meta_ad_account_id: value },
      { onConflict: "cliente_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/pauta`);
  revalidatePath("/paid-media");
  return { ok: true };
}

export async function saveAdsNotes(
  clientId: string,
  campanas_notas: string | null,
  notas: string | null
) {
  await requireUser();
  const admin = createAdmin();
  const { error } = await admin.from("client_ads_onboarding").upsert(
    {
      cliente_id: clientId,
      campanas_notas: campanas_notas?.trim() || null,
      notas: notas?.trim() || null,
    },
    { onConflict: "cliente_id" }
  );
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/pauta`);
  return { ok: true };
}
