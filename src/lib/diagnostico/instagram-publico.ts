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

export interface PostConImagen {
  timestamp: string;
  likes: number | null;
  comentarios: number | null;
  tipo: string;
  producto: string | null;
  permalink: string | null;
  /** La imagen para la grilla: la miniatura del video o la foto. */
  imagen: string | null;
}

export interface CuentaConHistorial extends PerfilPublico {
  foto: string | null;
  historial: PostConImagen[];
  /** true si se llegó hasta antes de `hasta` o se terminó el historial. */
  completo: boolean;
}

/**
 * El perfil y sus publicaciones hacia atrás, para el antes y el después de las
 * cuentas (17/10/2026). Pagina hasta llegar a `hasta` (las publicaciones
 * anteriores a esa fecha) o hasta `paginasMax` páginas de 50.
 */
export async function cuentaConHistorial(
  desdeIgId: string,
  usuario: string,
  opciones: { hasta?: string | null; paginasMax?: number } = {}
): Promise<CuentaConHistorial> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new Error("META_NO_TOKEN");
  const paginasMax = opciones.paginasMax ?? 6;
  const corte = opciones.hasta ? Date.parse(opciones.hasta) : null;
  const camposMedia = "timestamp,like_count,comments_count,media_type,media_product_type,permalink,media_url,thumbnail_url";
  let after: string | null = null;
  let perfil: Omit<CuentaConHistorial, "historial" | "posts" | "completo"> | null = null;
  const historial: PostConImagen[] = [];
  let completo = corte === null;

  for (let pagina = 0; pagina < paginasMax; pagina++) {
    const media = `media${after ? `.after(${after})` : ""}.limit(50){${camposMedia}}`;
    const campos = `business_discovery.username(${usuario}){username,name,biography,website,profile_picture_url,followers_count,media_count,${media}}`;
    const qs = new URLSearchParams({ fields: campos, access_token: token });
    const res = await fetch(`${GRAPH}/${desdeIgId}?${qs}`, { cache: "no-store" });
    const json = (await res.json()) as {
      business_discovery?: {
        username: string; name?: string; biography?: string; website?: string; profile_picture_url?: string;
        followers_count?: number; media_count?: number;
        media?: {
          data: {
            timestamp: string; like_count?: number; comments_count?: number; media_type: string;
            media_product_type?: string; permalink?: string; media_url?: string; thumbnail_url?: string;
          }[];
          paging?: { cursors?: { after?: string }; next?: string };
        };
      };
      error?: { message?: string; code?: number };
    };
    const bd = json.business_discovery;
    if (!bd) {
      const msg = json.error?.message ?? "";
      if (json.error?.code === 110 || /invalid user|cannot be found|not found|does not exist/i.test(msg))
        throw new CuentaNoDisponible(msg);
      throw new Error(`META_API: ${msg || res.status}`);
    }
    if (!perfil) {
      perfil = {
        usuario: bd.username,
        nombre: bd.name ?? null,
        biografia: bd.biography ?? null,
        web: bd.website ?? null,
        foto: bd.profile_picture_url ?? null,
        seguidores: bd.followers_count ?? 0,
        publicaciones: bd.media_count ?? 0,
      };
    }
    const data = bd.media?.data ?? [];
    for (const m of data) {
      historial.push({
        timestamp: m.timestamp,
        likes: typeof m.like_count === "number" ? m.like_count : null,
        comentarios: typeof m.comments_count === "number" ? m.comments_count : null,
        tipo: m.media_type,
        producto: m.media_product_type ?? null,
        permalink: m.permalink ?? null,
        imagen: m.thumbnail_url ?? (m.media_type !== "VIDEO" ? m.media_url ?? null : null),
      });
    }
    // business discovery no siempre trae `next`: si vino la página llena, hay más.
    after = data.length >= 50 ? bd.media?.paging?.cursors?.after ?? null : null;
    const masViejo = data.length ? Date.parse(data[data.length - 1].timestamp) : null;
    // Para el «antes» hacen falta 12 publicaciones anteriores al corte.
    const anteriores = corte === null ? 0 : historial.filter((h) => Date.parse(h.timestamp) < corte).length;
    if (!after || (masViejo !== null && corte !== null && masViejo < corte)) completo = true;
    if (!after || corte === null || (masViejo !== null && masViejo < corte && anteriores >= 12)) break;
  }

  return {
    ...(perfil as Omit<CuentaConHistorial, "historial" | "posts" | "completo">),
    posts: historial.slice(0, 25),
    historial,
    completo,
  };
}
