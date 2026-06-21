"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  listAvailableIgAccounts,
  friendlyIgError,
  type IgAccountOption,
} from "@/lib/meta/instagram";
import { syncClientInstagram } from "@/lib/social/sync";
import { tiktokConfigured, authorizeUrl } from "@/lib/tiktok";

const CAN_MANAGE = ["admin", "coordinador", "paid_media"];

function canManage(rol: string): boolean {
  return isStaff(rol) || CAN_MANAGE.includes(rol);
}

/** Lista las cuentas de IG disponibles en el system user, para elegir cuál es la del cliente. */
export async function listIgAccounts(): Promise<
  { ok: true; cuentas: IgAccountOption[] } | { error: string }
> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  try {
    const cuentas = await listAvailableIgAccounts();
    return { ok: true, cuentas };
  } catch (e) {
    return { error: friendlyIgError(e) };
  }
}

/** Conecta (o pega a mano) la cuenta de IG del cliente. */
export async function connectIgAccount(
  clienteId: string,
  igUserId: string,
  igUsername: string | null
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  const admin = createAdmin();
  const id = igUserId.trim();
  if (!id) return { error: "Falta el ID de la cuenta de Instagram." };
  if (!/^\d+$/.test(id))
    return { error: "El ID de Instagram debe ser numérico (ej: 17841400000000000)." };

  const { error } = await admin
    .from("clients")
    .update({ ig_user_id: id, ig_username: igUsername?.trim() || null })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clienteId}/resultados`);
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

/** Desconecta la cuenta de IG (no borra los snapshots históricos). */
export async function disconnectIgAccount(
  clienteId: string
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  const admin = createAdmin();
  const { error } = await admin
    .from("clients")
    .update({ ig_user_id: null, ig_username: null })
    .eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clienteId}/resultados`);
  return { ok: true };
}

/** Trae los resultados de IG ahora mismo y guarda el snapshot del día. */
export async function refreshIgResults(
  clienteId: string
): Promise<{ ok: true; followers: number; reach: number } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  try {
    const res = await syncClientInstagram(clienteId);
    if ("error" in res) return { error: res.error };
    revalidatePath(`/clientes/${clienteId}/resultados`);
    return res;
  } catch (e) {
    return { error: friendlyIgError(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TikTok (OAuth por cuenta)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el link de autorización de TikTok para este cliente (con state
 * firmado). El staff lo abre con el cliente o se lo manda para que lo autorice.
 */
export async function getTiktokAuthUrl(
  clienteId: string
): Promise<{ ok: true; url: string } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  if (!tiktokConfigured())
    return { error: "TikTok todavía no está configurado en la app." };
  try {
    return { ok: true, url: authorizeUrl(clienteId) };
  } catch {
    return { error: "No se pudo generar el link de TikTok." };
  }
}

/** Desconecta la cuenta de TikTok del cliente (borra el token guardado). */
export async function disconnectTiktok(
  clienteId: string
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me.rol)) return { error: "Sin acceso." };
  const admin = createAdmin();
  const { error } = await admin
    .from("client_tiktok_accounts")
    .delete()
    .eq("cliente_id", clienteId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clienteId}/resultados`);
  revalidatePath(`/clientes/${clienteId}/pauta`);
  return { ok: true };
}
