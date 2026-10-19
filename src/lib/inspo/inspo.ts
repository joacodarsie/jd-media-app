/**
 * Banco de inspiración (19/10/2026, 0207): lo puro.
 *
 * La clave es comparar cada pieza con LO NORMAL DE SU CUENTA: un reel con 2.000
 * me gusta no dice nada en una cuenta de un millón, y uno con 300 es un golazo
 * en una de 5.000. `rendimiento` = interacción de la pieza / mediana de la
 * cuenta en sus últimas publicaciones. 3× = rindió el triple de lo habitual.
 */
export interface MediaCruda {
  id: string;
  permalink?: string | null;
  caption?: string | null;
  media_type?: string | null; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string | null; // FEED | REELS
  timestamp?: string | null;
  like_count?: number | null;
  comments_count?: number | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
}

export type Formato = "reel" | "carrusel" | "foto" | "video";

export function formatoDe(m: { media_type?: string | null; media_product_type?: string | null }): Formato {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrusel";
  if (m.media_type === "VIDEO") return "video";
  return "foto";
}

export const ETIQUETA_FORMATO: Record<Formato, string> = { reel: "Reels", carrusel: "Carruseles", foto: "Fotos", video: "Videos" };
export const ETIQUETA_UNA: Record<Formato, string> = { reel: "Reel", carrusel: "Carrusel", foto: "Foto", video: "Video" };

const interaccion = (m: MediaCruda) => (m.like_count ?? 0) + 2 * (m.comments_count ?? 0);

export function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

/** El rendimiento de cada pieza contra la mediana del conjunto (su cuenta o su hashtag). */
export function conRendimiento<T extends MediaCruda>(media: T[]): (T & { rendimiento: number | null })[] {
  const base = mediana(media.map(interaccion).filter((x) => x > 0));
  return media.map((m) => ({ ...m, rendimiento: base > 0 ? Math.round((interaccion(m) / base) * 10) / 10 : null }));
}

export interface PiezaInspo {
  id: string;
  cuenta: string | null;
  permalink: string | null;
  caption: string | null;
  formato: Formato;
  publicado_at: string | null;
  likes: number | null;
  comentarios: number | null;
  imagen: string | null;
  rendimiento: number | null;
}

/** Qué formato rinde más en las referencias: rendimiento promedio por formato. */
export function formatosQueRinden(piezas: PiezaInspo[]): { formato: Formato; rendimiento: number; cantidad: number }[] {
  const por = new Map<Formato, number[]>();
  for (const p of piezas) {
    if (p.rendimiento == null) continue;
    por.set(p.formato, [...(por.get(p.formato) ?? []), p.rendimiento]);
  }
  return [...por.entries()]
    .filter(([, xs]) => xs.length >= 3)
    .map(([formato, xs]) => ({ formato, rendimiento: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, cantidad: xs.length }))
    .sort((a, b) => b.rendimiento - a.rendimiento);
}

/** Las que la rompieron: rindieron al menos el doble de lo normal, la mejor primero. */
export function lasQueLaRompieron(piezas: PiezaInspo[], max = 24): PiezaInspo[] {
  return piezas
    .filter((p) => (p.rendimiento ?? 0) >= 2)
    .sort((a, b) => (b.rendimiento ?? 0) - (a.rendimiento ?? 0))
    .slice(0, max);
}

/** Lo que publicaron las referencias en los últimos 7 días, lo más nuevo primero. */
export function deEstaSemana(piezas: PiezaInspo[], ahora: number): PiezaInspo[] {
  return piezas
    .filter((p) => p.publicado_at && ahora - Date.parse(p.publicado_at) <= 7 * 86_400_000)
    .sort((a, b) => Date.parse(b.publicado_at!) - Date.parse(a.publicado_at!));
}

/** "@usuario" o una URL de Instagram → "usuario"; "#tag" → "tag". */
export function limpiarFuente(tipo: "cuenta" | "hashtag", valor: string): string | null {
  let v = valor.trim().toLowerCase();
  if (tipo === "cuenta") {
    v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "").replace(/^@/, "");
    return /^[a-z0-9._]{1,30}$/.test(v) ? v : null;
  }
  v = v.replace(/^#/, "").replace(/\s+/g, "");
  return /^[\p{L}0-9_]{2,60}$/u.test(v) ? v : null;
}
