"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { syncClientPaidMedia } from "@/lib/paid-media/sync";
import { friendlyMetaError } from "@/lib/meta/ads";

const ROLES = ["admin", "coordinador", "paid_media"];
const PATH = "/paid-media";

/** Guarda / actualiza el ID de la cuenta publicitaria de Meta de un cliente. */
export async function saveAdAccountId(clienteId: string, adAccountId: string) {
  await requireRole(ROLES);
  const admin = createAdmin();
  const value = adAccountId.trim() || null;
  const { error } = await admin
    .from("client_ads_onboarding")
    .upsert(
      { cliente_id: clienteId, meta_ad_account_id: value },
      { onConflict: "cliente_id" }
    );
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Sincroniza ahora las métricas + análisis de un cliente desde Meta. */
export async function syncPaidMedia(clienteId: string) {
  await requireRole(ROLES);
  try {
    const res = await syncClientPaidMedia(clienteId);
    if ("error" in res) return { error: res.error };
    revalidatePath(PATH);
    return { ok: true };
  } catch (e) {
    return { error: friendlyMetaError(e) };
  }
}
