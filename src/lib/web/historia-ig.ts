/**
 * La historia de JD Media contada con su propio Instagram (23/10/2026), para
 * la página «Nosotros» de jdmedia.com.ar. Idea del dueño: mostrar los inicios
 * de la cuenta y algunas cosas que funcionaron, mezclados con «cómo nacimos».
 *
 * Puro: entran todas las publicaciones y las fotos diarias de la cuenta, salen
 * los tres tramos (los primeros posteos, lo que más se vio, lo último) y la
 * curva de seguidores.
 */
import type { IgMedia } from "@/lib/meta/instagram";

export interface PiezaIg {
  id: string;
  tipo: "reel" | "post" | "carrusel";
  fecha: string;
  texto: string;
  likes: number;
  alcance: number | null;
  link: string;
  imagen: string;
  video: string | null;
}

export interface HistoriaIg {
  usuario: string;
  seguidores: number;
  publicaciones: number;
  /** Fecha del primer posteo. */
  desde: string | null;
  primeros: PiezaIg[];
  destacados: PiezaIg[];
  recientes: PiezaIg[];
  /** Seguidores por semana, para la curva. */
  crecimiento: { fecha: string; seguidores: number }[];
}

/** La primera línea del texto, sin hashtags ni menciones sueltas al final. */
export function primeraLinea(caption: string | null, max = 90): string {
  const linea = (caption ?? "").split(/\n/).map((l) => l.trim()).find((l) => l && !/^[#@]/.test(l)) ?? "";
  const limpia = linea.replace(/\s+#\S+/g, "").trim();
  return limpia.length > max ? `${limpia.slice(0, max - 1).trimEnd()}…` : limpia;
}

function aPieza(m: IgMedia): PiezaIg | null {
  if (!m.permalink || !m.thumbnail_url || !m.timestamp) return null;
  return {
    id: m.id,
    tipo: m.media_type === "VIDEO" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "post",
    fecha: m.timestamp.slice(0, 10),
    texto: primeraLinea(m.caption),
    likes: m.like_count,
    alcance: m.reach,
    link: m.permalink,
    imagen: m.thumbnail_url,
    video: m.video_url ?? null,
  };
}

/** Una por semana (la última de cada una), para que la curva no pese. */
export function porSemana(fotos: { fecha: string; seguidores: number }[]): { fecha: string; seguidores: number }[] {
  const orden = [...fotos].filter((f) => f.seguidores > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const out: { fecha: string; seguidores: number }[] = [];
  for (const f of orden) {
    const ult = out[out.length - 1];
    const dias = ult ? (Date.parse(f.fecha) - Date.parse(ult.fecha)) / 86_400_000 : Infinity;
    if (dias >= 7) out.push(f);
  }
  const ultima = orden[orden.length - 1];
  if (ultima && out[out.length - 1]?.fecha !== ultima.fecha) out.push(ultima);
  return out;
}

export function armarHistoria(
  perfil: { usuario: string; seguidores: number; publicaciones: number },
  media: IgMedia[],
  fotos: { fecha: string; seguidores: number }[],
  cuantas = 4
): HistoriaIg {
  // Por hora exacta: el primer día salieron dos y la bienvenida fue la primera.
  const piezas = [...media]
    .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""))
    .map(aPieza)
    .filter((p): p is PiezaIg => !!p);
  const primeros = piezas.slice(0, cuantas);
  const recientes = piezas.slice(-cuantas).reverse().filter((p) => !primeros.some((x) => x.id === p.id));
  const usados = new Set([...primeros, ...recientes].map((p) => p.id));
  // Lo que más se vio: por alcance si lo hay, si no por likes.
  const destacados = piezas
    .filter((p) => !usados.has(p.id))
    .sort((a, b) => (b.alcance ?? 0) - (a.alcance ?? 0) || b.likes - a.likes)
    .slice(0, cuantas);
  return {
    ...perfil,
    desde: piezas[0]?.fecha ?? null,
    primeros,
    destacados,
    recientes,
    crecimiento: porSemana(fotos),
  };
}
