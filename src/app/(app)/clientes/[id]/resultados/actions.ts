"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  listAvailableIgAccounts,
  friendlyIgError,
  type IgAccountOption,
} from "@/lib/meta/instagram";
import { syncClientInstagram } from "@/lib/social/sync";
import {
  tiktokConfigured,
  authorizeUrl,
  getUserInfo,
  getVideoList,
  refreshToken,
  type TiktokVideo,
} from "@/lib/tiktok";

const CAN_MANAGE = ["admin", "coordinador", "paid_media"];

function canManage(me: { rol: string; rol_secundario?: string | null }): boolean {
  return isStaffUser(me) || userInRoles(me, CAN_MANAGE);
}

/** Lista las cuentas de IG disponibles en el system user, para elegir cuál es la del cliente. */
export async function listIgAccounts(): Promise<
  { ok: true; cuentas: IgAccountOption[] } | { error: string }
> {
  const me = await requireUser();
  if (!canManage(me)) return { error: "Sin acceso." };
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
  if (!canManage(me)) return { error: "Sin acceso." };
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
  if (!canManage(me)) return { error: "Sin acceso." };
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
  if (!canManage(me)) return { error: "Sin acceso." };
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
  if (!canManage(me)) return { error: "Sin acceso." };
  if (!tiktokConfigured())
    return { error: "TikTok todavía no está configurado en la app." };
  try {
    return { ok: true, url: authorizeUrl(clienteId) };
  } catch {
    return { error: "No se pudo generar el link de TikTok." };
  }
}

export interface TiktokResults {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  likes: number | null;
  videoCount: number | null;
  videos: TiktokVideo[];
}

/**
 * Trae los resultados orgánicos de TikTok del cliente (perfil + estadísticas +
 * videos). Usa el token guardado y lo refresca si venció. Demuestra los 3 scopes
 * (user.info.basic, user.info.stats, video.list) y es la base de la sección de
 * TikTok del reporte.
 */
export async function fetchTiktokResults(
  clienteId: string
): Promise<{ ok: true; data: TiktokResults } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me)) return { error: "Sin acceso." };
  if (!tiktokConfigured()) return { error: "TikTok todavía no está configurado." };

  const admin = createAdmin();
  const { data: acc } = await admin
    .from("client_tiktok_accounts")
    .select("access_token, refresh_token, token_expires_at")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!acc) return { error: "Este cliente no tiene TikTok conectado." };

  let accessToken = (acc as { access_token: string }).access_token;
  const expISO = (acc as { token_expires_at: string | null }).token_expires_at;
  const refresh = (acc as { refresh_token: string | null }).refresh_token;

  // Si el token venció (o vence en < 2 min), refrescarlo.
  if (refresh && expISO && new Date(expISO).getTime() - Date.now() < 120_000) {
    try {
      const t = await refreshToken(refresh);
      accessToken = t.access_token;
      const now = Date.now();
      await admin
        .from("client_tiktok_accounts")
        .update({
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          token_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
          refresh_expires_at: new Date(now + t.refresh_expires_in * 1000).toISOString(),
        })
        .eq("cliente_id", clienteId);
    } catch {
      return { error: "El acceso a TikTok venció. Reconectá la cuenta." };
    }
  }

  try {
    const [info, videos] = await Promise.all([
      getUserInfo(accessToken),
      getVideoList(accessToken, 12).catch(() => [] as TiktokVideo[]),
    ]);
    return {
      ok: true,
      data: {
        username: info.username,
        display_name: info.display_name,
        avatar_url: info.avatar_url,
        followers: info.follower_count,
        likes: info.likes_count,
        videoCount: info.video_count,
        videos,
      },
    };
  } catch (e) {
    console.error("fetchTiktokResults:", e);
    return { error: "No se pudieron traer los datos de TikTok. Probá de nuevo." };
  }
}

/** Desconecta la cuenta de TikTok del cliente (borra el token guardado). */
export async function disconnectTiktok(
  clienteId: string
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!canManage(me)) return { error: "Sin acceso." };
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
