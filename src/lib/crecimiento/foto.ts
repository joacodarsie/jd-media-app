/**
 * El antes y el después de cada cuenta, sin capturas a mano (17/10/2026).
 *
 * Pedido del dueño: «me cuesta mostrar el antes y el después o el
 * crecimiento». La plataforma toma sola una «foto» del Instagram de cada
 * cuenta: al arrancar y después una vez por mes. Para las cuentas que ya
 * estaban, el inicio se reconstruye con las publicaciones anteriores a la
 * fecha de arranque (lo que no se puede saber de ese día, como los seguidores
 * o la biografía, queda vacío).
 *
 * Módulo PURO: entran publicaciones y fechas, salen las métricas, qué fotos
 * faltan y la comparación lista para mostrar.
 */
import { diagnosticar, type PerfilPublico, type Pilar } from "@/lib/diagnostico/puntaje";

const DIA = 86_400_000;

export interface PostHistorial {
  timestamp: string;
  likes: number | null;
  comentarios: number | null;
  tipo: string;
  producto: string | null;
  permalink: string | null;
  imagen: string | null;
}

export interface CeldaGrilla {
  img: string;
  permalink: string | null;
  tipo: string;
  fecha: string;
}

export interface MetricasFoto {
  posts_mes: number;
  reels: number;
  interaccion: number | null;
  /** Las 9 publicaciones (con imagen) más recientes a esa fecha. */
  grilla: { imagen: string; permalink: string | null; tipo: string; fecha: string }[];
  /** Cuántas publicaciones había antes de la fecha (para saber si alcanza). */
  disponibles: number;
}

/** Métricas de la cuenta tal como estaba en `ref` (fin del día). */
export function metricasAFecha(historial: PostHistorial[], ref: string): MetricasFoto {
  const corte = Date.parse(`${ref}T23:59:59-03:00`);
  const previas = historial
    .filter((p) => Date.parse(p.timestamp) <= corte)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const ultimas = previas.slice(0, 12);
  const conLikes = ultimas.filter((p) => p.likes !== null);
  const interaccion = conLikes.length
    ? Math.round(conLikes.reduce((s, p) => s + (p.likes ?? 0) + (p.comentarios ?? 0), 0) / conLikes.length)
    : null;
  return {
    posts_mes: previas.filter((p) => corte - Date.parse(p.timestamp) <= 30 * DIA).length,
    reels: ultimas.filter((p) => p.producto === "REELS" || p.tipo === "VIDEO").length,
    interaccion,
    grilla: previas
      .filter((p) => p.imagen)
      .slice(0, 9)
      .map((p) => ({ imagen: p.imagen as string, permalink: p.permalink, tipo: p.tipo, fecha: p.timestamp.slice(0, 10) })),
    disponibles: previas.length,
  };
}

/** El puntaje de 0 a 100 de una foto real (con el perfil de ese día). */
export function puntajeDeHoy(perfil: Omit<PerfilPublico, "posts">, historial: PostHistorial[], hoy: string): { puntaje: number; pilares: Pilar[] } {
  const ahora = Date.parse(`${hoy}T12:00:00-03:00`);
  const d = diagnosticar({ ...perfil, posts: historial.slice(0, 25) }, ahora);
  return { puntaje: d.puntaje, pilares: d.pilares };
}

export interface FotoExistente {
  tipo: "inicio" | "mensual";
  fecha: string;
}

export interface FotoAPedir {
  tipo: "inicio" | "mensual";
  /** La fecha que retrata la foto. */
  fecha: string;
  /** false: se reconstruye con publicaciones viejas. */
  real: boolean;
}

/**
 * Qué fotos le faltan a una cuenta hoy.
 *
 * - Sin foto de inicio: si arrancó hace 7 días o menos (o no tiene fecha), se
 *   saca hoy y es real. Si arrancó antes, se reconstruye a la fecha de inicio
 *   y además se saca la de hoy para tener contra qué comparar.
 * - Con inicio: una mensual cuando la última foto tiene 28 días o más.
 */
export function fotosQueFaltan(existentes: FotoExistente[], hoy: string, fechaInicio: string | null): FotoAPedir[] {
  const pedir: FotoAPedir[] = [];
  const tieneInicio = existentes.some((f) => f.tipo === "inicio");
  const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA);

  if (!tieneInicio) {
    if (!fechaInicio || fechaInicio > hoy || dias(fechaInicio, hoy) <= 7) {
      pedir.push({ tipo: "inicio", fecha: hoy, real: true });
      return pedir;
    }
    pedir.push({ tipo: "inicio", fecha: fechaInicio, real: false });
  }
  const ultima = [...existentes].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.fecha ?? null;
  if (!ultima || dias(ultima, hoy) >= 28 || !tieneInicio) pedir.push({ tipo: "mensual", fecha: hoy, real: true });
  return pedir;
}

export interface FotoGuardada {
  tipo: "inicio" | "mensual";
  fecha: string;
  real: boolean;
  seguidores: number | null;
  publicaciones: number | null;
  posts_mes: number | null;
  reels: number | null;
  interaccion: number | null;
  puntaje: number | null;
}

export interface Comparacion {
  clave: "seguidores" | "posts_mes" | "interaccion" | "reels" | "puntaje";
  titulo: string;
  antes: number;
  hoy: number;
  /** Texto corto del cambio: «+112%», «×3», «+8». */
  cambio: string;
  mejoro: boolean;
  explicacion: string;
}

function textoCambio(antes: number, hoy: number, porcentaje: boolean): string {
  const dif = hoy - antes;
  if (!porcentaje || antes <= 0) return `${dif >= 0 ? "+" : ""}${dif.toLocaleString("es-AR")}`;
  if (hoy >= antes * 3) return `×${Math.round((hoy / antes) * 10) / 10}`.replace(".", ",");
  const pct = Math.round((dif / antes) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * Inicio contra hoy, solo con lo que se puede comparar de verdad. Los
 * seguidores salen de la primera medición que haya (la foto de inicio si fue
 * real, o el primer registro diario de Instagram).
 */
export function comparar(inicio: FotoGuardada, hoy: FotoGuardada, seguidoresIniciales: number | null): Comparacion[] {
  const out: Comparacion[] = [];
  const segAntes = inicio.seguidores ?? seguidoresIniciales;
  if (segAntes !== null && hoy.seguidores !== null && segAntes > 0) {
    out.push({
      clave: "seguidores",
      titulo: "Seguidores",
      antes: segAntes,
      hoy: hoy.seguidores,
      cambio: textoCambio(segAntes, hoy.seguidores, true),
      mejoro: hoy.seguidores > segAntes,
      explicacion: `${(hoy.seguidores - segAntes).toLocaleString("es-AR")} personas nuevas siguen la cuenta`,
    });
  }
  if (inicio.posts_mes !== null && hoy.posts_mes !== null) {
    out.push({
      clave: "posts_mes",
      titulo: "Publicaciones por mes",
      antes: inicio.posts_mes,
      hoy: hoy.posts_mes,
      cambio: textoCambio(inicio.posts_mes, hoy.posts_mes, inicio.posts_mes > 0),
      mejoro: hoy.posts_mes > inicio.posts_mes,
      explicacion: inicio.posts_mes === 0 ? "La cuenta estaba quieta antes de arrancar" : "Una cuenta activa todas las semanas",
    });
  }
  if (inicio.interaccion !== null && hoy.interaccion !== null) {
    out.push({
      clave: "interaccion",
      titulo: "Interacción por publicación",
      antes: inicio.interaccion,
      hoy: hoy.interaccion,
      cambio: textoCambio(inicio.interaccion, hoy.interaccion, true),
      mejoro: hoy.interaccion > inicio.interaccion,
      explicacion: "Promedio de me gusta y comentarios en cada publicación",
    });
  }
  if (inicio.reels !== null && hoy.reels !== null) {
    out.push({
      clave: "reels",
      titulo: "Reels (de las últimas 12)",
      antes: inicio.reels,
      hoy: hoy.reels,
      cambio: textoCambio(inicio.reels, hoy.reels, false),
      mejoro: hoy.reels > inicio.reels,
      explicacion: "El formato que más alcance trae",
    });
  }
  if (inicio.real && inicio.puntaje !== null && hoy.puntaje !== null) {
    out.push({
      clave: "puntaje",
      titulo: "Puntaje de la cuenta",
      antes: inicio.puntaje,
      hoy: hoy.puntaje,
      cambio: textoCambio(inicio.puntaje, hoy.puntaje, false),
      mejoro: hoy.puntaje > inicio.puntaje,
      explicacion: "Constancia, interacción, formatos y perfil, de 0 a 100",
    });
  }
  return out;
}
