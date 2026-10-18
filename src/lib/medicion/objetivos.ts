/**
 * El porqué de cada publicación y cómo se mide (17/10/2026).
 *
 * Pedido de un cliente con mucha trayectoria (Global Business Lab): «cada
 * publicación tiene que tener un porqué, y el porqué un parámetro de
 * medición». La community elige para qué sale la pieza y cuánto espera; la
 * plataforma busca sola el resultado en Instagram y lo compara.
 *
 * Módulo PURO.
 */

export type Objetivo = "conocer" | "interactuar" | "guardar" | "consultar";

export interface DefObjetivo {
  clave: Objetivo;
  /** Cómo lo dice la community (y el cliente en su portal). */
  titulo: string;
  /** Qué se mide, en plural, para «Meta: 500 …». */
  unidad: string;
  /** Si Instagram lo da solo o lo carga la community. */
  automatico: boolean;
  ayuda: string;
}

export const OBJETIVOS: DefObjetivo[] = [
  { clave: "conocer", titulo: "Que nos conozcan", unidad: "cuentas alcanzadas", automatico: true, ayuda: "Llegar a gente nueva. Se mide el alcance." },
  { clave: "interactuar", titulo: "Que interactúen", unidad: "interacciones", automatico: true, ayuda: "Me gusta, comentarios y guardados." },
  { clave: "guardar", titulo: "Que lo guarden", unidad: "guardados", automatico: true, ayuda: "Contenido útil que la gente se queda para después." },
  { clave: "consultar", titulo: "Que consulten", unidad: "consultas", automatico: false, ayuda: "Mensajes o pedidos que trajo la pieza: los carga la community." },
];

export const objetivoDe = (clave: string | null | undefined): DefObjetivo | null =>
  OBJETIVOS.find((o) => o.clave === clave) ?? null;

/** Las métricas de una publicación tal como las da Instagram. */
export interface MetricasPieza {
  alcance: number | null;
  likes: number | null;
  comentarios: number | null;
  guardados: number | null;
}

/** El número que corresponde al objetivo, o null si Instagram no lo da. */
export function valorDelObjetivo(objetivo: Objetivo, m: MetricasPieza | null, consultas: number | null): number | null {
  if (objetivo === "consultar") return consultas;
  if (!m) return null;
  if (objetivo === "conocer") return m.alcance;
  if (objetivo === "guardar") return m.guardados;
  if (m.likes === null && m.comentarios === null && m.guardados === null) return null;
  return (m.likes ?? 0) + (m.comentarios ?? 0) + (m.guardados ?? 0);
}

export type EstadoMeta = "superada" | "cumplida" | "cerca" | "lejos" | "sin_dato" | "sin_meta";

/** Cómo le fue contra la meta: cumplida desde el 100 %, cerca desde el 70 %. */
export function estadoDeMeta(valor: number | null, meta: number | null): EstadoMeta {
  if (valor === null) return "sin_dato";
  if (!meta) return "sin_meta";
  const k = valor / meta;
  if (k >= 1.3) return "superada";
  if (k >= 1) return "cumplida";
  if (k >= 0.7) return "cerca";
  return "lejos";
}

export const TEXTO_ESTADO: Record<EstadoMeta, string> = {
  superada: "Superó la meta",
  cumplida: "Cumplió la meta",
  cerca: "Cerca de la meta",
  lejos: "Lejos de la meta",
  sin_dato: "Todavía sin datos",
  sin_meta: "Sin meta cargada",
};

/** Normaliza un link de Instagram para comparar (sin parámetros ni barra final). */
export function permalinkClave(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[2] : null;
}

/** Cuándo se mide: entre 2 y 30 días después de publicada (los primeros días todavía crece). */
export function tocaMedir(publicadaEl: string, ahora = Date.now()): boolean {
  const dias = (ahora - Date.parse(publicadaEl)) / 86_400_000;
  return dias >= 2 && dias <= 30;
}
