/**
 * Integración con TikTok (API v2) para traer resultados orgánicos por cuenta.
 *
 * A diferencia de Instagram (que usa el system user token de Meta y ve todas las
 * cuentas asignadas), TikTok exige **OAuth por cuenta**: cada cliente autoriza su
 * propia cuenta de TikTok una vez. Por eso este módulo implementa el flujo OAuth
 * (authorize → callback → tokens) y guarda un token por cliente.
 *
 * Todo está **gateado por credenciales**: si no están seteadas las env
 * `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`, `tiktokConfigured()` da false y la
 * UI de conexión ni aparece. Inerte en producción hasta que la app de TikTok esté
 * aprobada y las credenciales cargadas (ver docs/tiktok-setup.md).
 */

import { createHmac } from "node:crypto";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";

// Permisos necesarios para el reporte (requieren app review en producción):
//  - user.info.basic  → open_id, display_name, username, avatar
//  - user.info.stats  → follower_count, following_count, likes_count, video_count
//  - video.list       → listado de videos del mes (views/likes/comments/shares)
const SCOPES = ["user.info.basic", "user.info.stats", "video.list"];

function envOrNull(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

/** True solo si la app de TikTok está configurada (credenciales presentes). */
export function tiktokConfigured(): boolean {
  return !!envOrNull("TIKTOK_CLIENT_KEY") && !!envOrNull("TIKTOK_CLIENT_SECRET");
}

function clientKey(): string {
  const v = envOrNull("TIKTOK_CLIENT_KEY");
  if (!v) throw new Error("TIKTOK_CLIENT_KEY no configurada");
  return v;
}
function clientSecret(): string {
  const v = envOrNull("TIKTOK_CLIENT_SECRET");
  if (!v) throw new Error("TIKTOK_CLIENT_SECRET no configurada");
  return v;
}

/** Redirect URI registrada en la app de TikTok. Deriva de la URL pública. */
export function redirectUri(): string {
  const base =
    envOrNull("TIKTOK_REDIRECT_URI") ??
    `${envOrNull("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000"}/api/tiktok/callback`;
  return base;
}

// ── State firmado (evita que cualquiera conecte un TikTok a un cliente ajeno) ──
// state = base64url({ c: clienteId, t: timestamp }) + "." + HMAC. El callback lo
// valida con el client_secret antes de guardar el token.
export function signState(clienteId: string): string {
  const payload = Buffer.from(JSON.stringify({ c: clienteId, t: Date.now() })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", clientSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): { clienteId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", clientSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      c: string;
      t: number;
    };
    // El state vence a los 30 minutos.
    if (Date.now() - data.t > 30 * 60 * 1000) return null;
    return { clienteId: data.c };
  } catch {
    return null;
  }
}

/** URL a la que se manda al usuario para que autorice su cuenta de TikTok. */
export function authorizeUrl(clienteId: string): string {
  const params = new URLSearchParams({
    client_key: clientKey(),
    scope: SCOPES.join(","),
    response_type: "code",
    redirect_uri: redirectUri(),
    state: signState(clienteId),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TiktokTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
  refresh_expires_in: number;
  open_id: string;
  scope: string;
}

export async function exchangeCode(code: string): Promise<TiktokTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey(),
      client_secret: clientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error_description || json.error || "TikTok token exchange falló");
  }
  return json as TiktokTokens;
}

export async function refreshToken(refresh: string): Promise<TiktokTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error_description || json.error || "TikTok refresh falló");
  }
  return json as TiktokTokens;
}

export interface TiktokUserInfo {
  open_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  video_count: number | null;
}

export async function getUserInfo(accessToken: string): Promise<TiktokUserInfo> {
  // OJO: `username` requiere el scope user.info.profile (que NO pedimos). Si se
  // incluye, TikTok rechaza todo el request ("scope not authorized"). Con
  // user.info.basic + user.info.stats alcanza para el reporte; el nombre visible
  // sale de display_name.
  const fields =
    "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count";
  const res = await fetch(`${USER_INFO_URL}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok || json.error?.code !== "ok") {
    throw new Error(json.error?.message || "TikTok user/info falló");
  }
  const u = json.data?.user ?? {};
  return {
    open_id: u.open_id,
    username: u.username ?? null,
    display_name: u.display_name ?? null,
    avatar_url: u.avatar_url ?? null,
    follower_count: u.follower_count ?? null,
    following_count: u.following_count ?? null,
    likes_count: u.likes_count ?? null,
    video_count: u.video_count ?? null,
  };
}

export interface TiktokVideo {
  id: string;
  create_time: number; // epoch segundos
  title: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

/** Lista de videos de la cuenta (paginada por TikTok; traemos la primera página). */
export async function getVideoList(accessToken: string, maxCount = 20): Promise<TiktokVideo[]> {
  const fields = "id,create_time,title,view_count,like_count,comment_count,share_count";
  const res = await fetch(`${VIDEO_LIST_URL}?fields=${fields}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ max_count: maxCount }),
  });
  const json = await res.json();
  if (!res.ok || json.error?.code !== "ok") {
    throw new Error(json.error?.message || "TikTok video/list falló");
  }
  return (json.data?.videos ?? []) as TiktokVideo[];
}
