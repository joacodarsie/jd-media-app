/**
 * Piezas congeladas (22/10/2026).
 *
 * En CATCH había reels sin un solo movimiento desde el 4/10 y nadie se enteró
 * hasta que se pasaron las fechas. Al 22/10 eran 42 piezas en toda la agencia,
 * 16 de ellas de edición. «Vencida» no alcanza para verlo: una pieza puede
 * estar quieta dos semanas y recién «vencer» el día que tenía que salir.
 *
 * Congelada = una pieza en producción (no idea, no publicada) cuya tarea lleva
 * DIAS_QUIETA días sin ningún movimiento —ni cambio de estado, ni link, ni
 * edición de la pieza— y que tiene que salir dentro de VENTANA_DIAS o ya se le
 * pasó la fecha. Las frenadas por el cliente o marcadas «¿Trabada?» no cuentan:
 * ahí ya se sabe qué falta.
 *
 * Puro: entran las piezas con su último movimiento, salen las congeladas
 * agrupadas por persona.
 */

export const DIAS_QUIETA = 5;
export const VENTANA_DIAS = 7;

export interface PiezaParaCongelar {
  taskId: string;
  titulo: string;
  cuenta: string;
  /** "YYYY-MM-DD" de publicación. */
  fecha: string;
  responsableId: string | null;
  responsable: string | null;
  /** ISO del último movimiento (historial, pieza o creación). */
  ultimoMovimiento: string;
  bloqueada: boolean;
}

export interface Congelada extends PiezaParaCongelar {
  diasQuieta: number;
  atrasada: boolean;
}

export interface GrupoCongeladas {
  responsableId: string | null;
  responsable: string;
  piezas: Congelada[];
  /** Los días de la más vieja. */
  maxDias: number;
}

const diaUtc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const diasEntre = (a: string, b: string) => Math.round((diaUtc(b) - diaUtc(a)) / 86_400_000);

export function piezasCongeladas(piezas: PiezaParaCongelar[], hoy: string): Congelada[] {
  return piezas
    .filter((p) => !p.bloqueada)
    .map((p) => ({ ...p, diasQuieta: diasEntre(p.ultimoMovimiento.slice(0, 10), hoy), atrasada: p.fecha < hoy }))
    .filter((p) => p.diasQuieta >= DIAS_QUIETA && diasEntre(hoy, p.fecha) <= VENTANA_DIAS)
    .sort((a, b) => b.diasQuieta - a.diasQuieta);
}

/** Agrupadas por persona, la que más tiene primero. */
export function porResponsable(congeladas: Congelada[]): GrupoCongeladas[] {
  const m = new Map<string, GrupoCongeladas>();
  for (const p of congeladas) {
    const k = p.responsableId ?? "sin";
    const g = m.get(k) ?? { responsableId: p.responsableId, responsable: p.responsable ?? "Sin responsable", piezas: [], maxDias: 0 };
    g.piezas.push(p);
    g.maxDias = Math.max(g.maxDias, p.diasQuieta);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.piezas.length - a.piezas.length || b.maxDias - a.maxDias);
}

/** El aviso diario a coordinación: uno solo, con el total y los que más tienen. */
export function avisoCongeladas(grupos: GrupoCongeladas[]): string | null {
  const total = grupos.reduce((n, g) => n + g.piezas.length, 0);
  if (!total) return null;
  const top = grupos
    .slice(0, 3)
    .map((g) => `${g.responsable.split(" ")[0]} ${g.piezas.length}`)
    .join(", ");
  return `🧊 ${total} pieza${total === 1 ? "" : "s"} sin moverse hace ${DIAS_QUIETA} días o más: ${top}${grupos.length > 3 ? " y más" : ""}.`;
}

/** Lo que le llega a la persona cuando coordinación toca «Avisar». */
export function mensajeAvisoPersona(nombreQuienAvisa: string, g: GrupoCongeladas): string {
  const lista = g.piezas
    .slice(0, 3)
    .map((p) => `«${p.titulo.length > 35 ? p.titulo.slice(0, 34) + "…" : p.titulo}» (${p.cuenta})`)
    .join(", ");
  const resto = g.piezas.length > 3 ? ` y ${g.piezas.length - 3} más` : "";
  return `🧊 ${nombreQuienAvisa.split(" ")[0]} te pregunta por ${g.piezas.length === 1 ? "una pieza que no se mueve" : `${g.piezas.length} piezas que no se mueven`} hace días: ${lista}${resto}. Si te falta algo, tocá «¿Trabada?» en la tarea.`;
}
