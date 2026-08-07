/**
 * Conciliación Instagram ↔ calendario: ¿lo que dice la app que salió, salió?
 *
 * Por qué existe. El 6 de agosto de 2026, comparando el feed real de Instagram
 * contra el calendario, el desvío iba para los dos lados:
 *   - Boxescar y Power Collections habían publicado y en la app figuraba 0.
 *   - Résonar figuraba con una pieza "publicado" que en Instagram no existía.
 * Con eso, ni la puntualidad, ni el semáforo del Director, ni el reporte del
 * cliente dicen la verdad. Y marcar a mano no funciona: nadie lo hace.
 *
 * Este módulo cruza las dos listas y decide, sin llamar a nada: qué pieza
 * corresponde a qué posteo, qué salió sin estar en el calendario y qué figura
 * como publicado sin haber salido. Es puro para poder testearlo.
 *
 * Las historias NO entran: la API de Instagram solo expone las de las últimas
 * 24 h, así que una historia jamás aparecería en el feed conciliado y se
 * marcaría como fantasma por error.
 */

import { ymdEnZona } from "@/lib/dates";

export interface PiezaConciliable {
  id: string;
  titulo: string;
  copy: string | null;
  tipo: string | null;
  red: string;
  estado: string;
  /** ISO, puede traer hora. */
  fecha_publicacion: string | null;
  ig_media_id?: string | null;
}

export interface MediaIg {
  id: string;
  caption: string | null;
  /** IMAGE | VIDEO | CAROUSEL_ALBUM */
  media_type: string;
  permalink: string | null;
  /** ISO con zona (viene en UTC). */
  timestamp: string | null;
}

export type MotivoMatch = "id" | "texto" | "fecha";
export type Confianza = "alta" | "media";

export interface MatchConciliado {
  piezaId: string;
  piezaTitulo: string;
  mediaId: string;
  permalink: string | null;
  /** Cuándo salió de verdad (fecha de Córdoba). */
  fechaReal: string | null;
  /** Cuándo estaba planificada. */
  fechaPlan: string | null;
  /** >0 salió tarde, <0 salió antes, 0 en fecha. null si falta alguna. */
  diasDiferencia: number | null;
  motivo: MotivoMatch;
  confianza: Confianza;
  /** La pieza ya estaba en "publicado": no hay nada que corregir. */
  yaMarcada: boolean;
  /** Cuánto se parecen el copy y el caption (0-1). Solo informativo. */
  score: number;
}

export interface PiezaFantasma {
  piezaId: string;
  titulo: string;
  fechaPlan: string | null;
}

export interface Conciliacion {
  /** Pieza ↔ posteo real. Las de confianza "alta" se aplican solas. */
  matches: MatchConciliado[];
  /** Salió en Instagram y no hay ninguna pieza que le corresponda. */
  sinPieza: MediaIg[];
  /** La app dice "publicado" y en Instagram no está. */
  fantasmas: PiezaFantasma[];
}

/** Tipos de pieza que la API de feed nunca va a devolver. */
const TIPOS_FUERA_DEL_FEED = ["historia", "story", "stories"];

/**
 * Texto comparable: sin acentos, sin emojis, sin puntuación ni hashtags, en
 * minúsculas y con los espacios colapsados. El caption de Instagram y el copy
 * de la app son el mismo texto pasado por manos distintas (se le agregan
 * hashtags, se corrige una coma), así que la comparación tiene que ser laxa.
 */
export function normalizarTexto(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/#[\w]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabras(s: string): Set<string> {
  return new Set(s.split(" ").filter((w) => w.length >= 4));
}

/** Cuánto se parecen dos textos, 0 a 1. */
export function similitud(a: string | null | undefined, b: string | null | undefined): number {
  const x = normalizarTexto(a);
  const y = normalizarTexto(b);
  if (!x || !y) return 0;

  // El caption suele ser el copy + hashtags, o el copy recortado a 300 chars.
  // Si el arranque de uno está dentro del otro, es el mismo texto.
  const PREFIJO = 45;
  if (x.length >= PREFIJO && y.includes(x.slice(0, PREFIJO))) return 1;
  if (y.length >= PREFIJO && x.includes(y.slice(0, PREFIJO))) return 1;

  const px = palabras(x);
  const py = palabras(y);
  if (px.size === 0 || py.size === 0) return 0;
  let comunes = 0;
  for (const w of px) if (py.has(w)) comunes++;
  return comunes / (px.size + py.size - comunes);
}

/** Score a partir del cual damos el match por seguro. */
const UMBRAL_ALTA = 0.55;
/** Score mínimo para proponerlo (con confirmación humana). */
const UMBRAL_MEDIA = 0.3;
/** Días de tolerancia para un match flojo de texto. */
const VENTANA_DIAS = 4;

function diffDias(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function esDelFeed(p: PiezaConciliable): boolean {
  const tipo = (p.tipo ?? "").toLowerCase();
  return !TIPOS_FUERA_DEL_FEED.some((t) => tipo.includes(t));
}

/**
 * Cruza las piezas del calendario de una cuenta con lo que realmente salió.
 *
 * `desde`/`hasta` (YYYY-MM-DD) son el rango que cubre `medias`: fuera de esa
 * ventana no se puede afirmar nada, así que una pieza de antes no se marca como
 * fantasma solo porque el feed traído no llega hasta ahí.
 */
export function conciliar(
  piezas: PiezaConciliable[],
  medias: MediaIg[],
  rango: {
    desde: string;
    hasta: string;
    /**
     * ¿Podemos confiar en que el feed está completo? Un feed vacío puede ser
     * "no publicaron nada" (dato válido, y ahí los fantasmas son reales) o un
     * problema de permisos (y ahí acusaríamos de fantasma a todo el mes). Por
     * defecto solo confiamos si vino al menos un posteo; quien llama puede
     * confirmarlo por otra vía — por ejemplo que el total de publicaciones de
     * la cuenta no se haya movido en todo el mes.
     */
    feedConfiable?: boolean;
  },
): Conciliacion {
  const candidatas = piezas.filter((p) => p.red === "instagram" && esDelFeed(p));
  const matches: MatchConciliado[] = [];
  const piezasUsadas = new Set<string>();
  const mediasUsadas = new Set<string>();

  const fechaDe = (p: PiezaConciliable) => p.fecha_publicacion?.slice(0, 10) ?? null;

  const armar = (
    p: PiezaConciliable,
    m: MediaIg,
    motivo: MotivoMatch,
    confianza: Confianza,
    score: number,
  ): MatchConciliado => {
    const fechaReal = ymdEnZona(m.timestamp);
    const fechaPlan = fechaDe(p);
    return {
      piezaId: p.id,
      piezaTitulo: p.titulo,
      mediaId: m.id,
      permalink: m.permalink,
      fechaReal,
      fechaPlan,
      diasDiferencia: diffDias(fechaReal, fechaPlan),
      motivo,
      confianza,
      yaMarcada: p.estado === "publicado",
      score,
    };
  };

  // 1) El identificador de Instagram ya guardado (lo dejó el auto-publicador).
  //    Es la única evidencia que no admite duda.
  const porMediaId = new Map(medias.map((m) => [m.id, m]));
  for (const p of candidatas) {
    const m = p.ig_media_id ? porMediaId.get(p.ig_media_id) : undefined;
    if (!m) continue;
    matches.push(armar(p, m, "id", "alta", 1));
    piezasUsadas.add(p.id);
    mediasUsadas.add(m.id);
  }

  // 2) Por texto. Se calculan todos los pares y se asigna de mayor a menor,
  //    para que un caption no se lleve una pieza que le calza mejor a otro.
  const pares: { p: PiezaConciliable; m: MediaIg; score: number }[] = [];
  for (const p of candidatas) {
    if (piezasUsadas.has(p.id)) continue;
    for (const m of medias) {
      if (mediasUsadas.has(m.id)) continue;
      const score = similitud(p.copy, m.caption);
      if (score >= UMBRAL_MEDIA) pares.push({ p, m, score });
    }
  }
  pares.sort((a, b) => b.score - a.score);
  for (const { p, m, score } of pares) {
    if (piezasUsadas.has(p.id) || mediasUsadas.has(m.id)) continue;
    const dias = diffDias(ymdEnZona(m.timestamp), fechaDe(p));
    // Un texto flojo solo vale si además las fechas están cerca.
    if (score < UMBRAL_ALTA && (dias == null || Math.abs(dias) > VENTANA_DIAS)) continue;
    matches.push(armar(p, m, "texto", score >= UMBRAL_ALTA ? "alta" : "media", score));
    piezasUsadas.add(p.id);
    mediasUsadas.add(m.id);
  }

  // 3) Mismo día y candidata única. Sirve para las piezas sin copy cargado
  //    (pasa seguido con los reels, donde el texto va en el guion).
  for (const m of medias) {
    if (mediasUsadas.has(m.id)) continue;
    const dia = ymdEnZona(m.timestamp);
    if (!dia) continue;
    const mismas = candidatas.filter((p) => !piezasUsadas.has(p.id) && fechaDe(p) === dia);
    if (mismas.length !== 1) continue;
    const p = mismas[0];
    matches.push(armar(p, m, "fecha", "media", 0));
    piezasUsadas.add(p.id);
    mediasUsadas.add(m.id);
  }

  const sinPieza = medias.filter((m) => !mediasUsadas.has(m.id));

  // Fantasmas: figuran publicadas, están dentro de la ventana que cubre el feed
  // y no aparecieron.
  const confiable = rango.feedConfiable ?? medias.length > 0;
  const fantasmas: PiezaFantasma[] = !confiable
    ? []
    : candidatas
        .filter((p) => p.estado === "publicado" && !piezasUsadas.has(p.id))
        .filter((p) => {
          const f = fechaDe(p);
          return !!f && f >= rango.desde && f <= rango.hasta;
        })
        .map((p) => ({ piezaId: p.id, titulo: p.titulo, fechaPlan: fechaDe(p) }));

  return { matches, sinPieza, fantasmas };
}

/** Los que se aplican solos: evidencia fuerte y algo que corregir. */
export function matchesAutomaticos(c: Conciliacion): MatchConciliado[] {
  return c.matches.filter((m) => m.confianza === "alta" && !m.yaMarcada);
}

/** Los que necesitan que una persona diga que sí. */
export function matchesADudar(c: Conciliacion): MatchConciliado[] {
  return c.matches.filter((m) => m.confianza === "media" && !m.yaMarcada);
}

/**
 * Resumen de puntualidad REAL de la cuenta: de lo que salió, cuánto salió el
 * día planificado. Es el número que el calendario solo no puede dar.
 */
export function resumirConciliacion(c: Conciliacion): {
  salieron: number;
  enFecha: number;
  tarde: number;
  antes: number;
  sinPieza: number;
  fantasmas: number;
} {
  let enFecha = 0;
  let tarde = 0;
  let antes = 0;
  for (const m of c.matches) {
    if (m.diasDiferencia == null) continue;
    if (m.diasDiferencia === 0) enFecha++;
    else if (m.diasDiferencia > 0) tarde++;
    else antes++;
  }
  return {
    salieron: c.matches.length + c.sinPieza.length,
    enFecha,
    tarde,
    antes,
    sinPieza: c.sinPieza.length,
    fantasmas: c.fantasmas.length,
  };
}
