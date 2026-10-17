/**
 * Datos públicos de cualquier cuenta de Instagram de empresa o creador, con la
 * función «business discovery» de la API de Meta (17/10/2026). Es gratis: se
 * consulta desde la cuenta de JD Media con el mismo token del sistema que usa
 * el resto de la plataforma. Las cuentas personales o privadas no responden.
 */
import type { PerfilPublico } from "./puntaje";

const GRAPH = "https://graph.facebook.com/v21.0";

export class CuentaNoDisponible extends Error {}

interface Respuesta {
  business_discovery?: {
    username: string;
    name?: string;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
    media?: {
      data: {
        timestamp: string;
        like_count?: number;
        comments_count?: number;
        media_type: string;
        media_product_type?: string;
      }[];
    };
  };
  error?: { message?: string; code?: number; error_subcode?: number };
}

export async function perfilPublico(
  desdeIgId: string,
  usuario: string
): Promise<PerfilPublico & { foto: string | null }> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new Error("META_NO_TOKEN");
  const campos =
    `business_discovery.username(${usuario}){username,name,biography,website,profile_picture_url,` +
    `followers_count,media_count,media.limit(25){timestamp,like_count,comments_count,media_type,media_product_type}}`;
  const qs = new URLSearchParams({ fields: campos, access_token: token });
  const res = await fetch(`${GRAPH}/${desdeIgId}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as Respuesta;
  const bd = json.business_discovery;
  if (!bd) {
    // 110 / «Invalid user id» / «cannot be found»: no existe o no es de empresa.
    const msg = json.error?.message ?? "";
    if (json.error?.code === 110 || /invalid user|cannot be found|not found|does not exist/i.test(msg))
      throw new CuentaNoDisponible(msg);
    throw new Error(`META_API: ${msg || res.status}`);
  }
  return {
    usuario: bd.username,
    nombre: bd.name ?? null,
    biografia: bd.biography ?? null,
    web: bd.website ?? null,
    foto: bd.profile_picture_url ?? null,
    seguidores: bd.followers_count ?? 0,
    publicaciones: bd.media_count ?? 0,
    posts: (bd.media?.data ?? []).map((m) => ({
      timestamp: m.timestamp,
      likes: typeof m.like_count === "number" ? m.like_count : null,
      comentarios: typeof m.comments_count === "number" ? m.comments_count : null,
      tipo: m.media_type,
      producto: m.media_product_type ?? null,
    })),
  };
}
