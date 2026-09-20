/**
 * Cuánto vive un aviso.
 *
 * Al 20/9/2026 la campana tenía 870 avisos sin leer (Joaquín 178, Leo 177, Luz
 * 169) sobre una tabla de 17.015 filas, y la única limpieza que había borraba
 * las LEÍDAS de más de 60 días — o sea, justo las que no molestaban. Una
 * campana con 178 cosas adentro no se lee: se apaga.
 *
 * La regla sale de distinguir dos cosas que hoy conviven en la misma tabla:
 *
 * - Un **recordatorio** ("tenés 12 tareas vencidas", "hay cobros atrasados") es
 *   una foto del estado de hoy. El cron la vuelve a sacar mañana. Guardar la de
 *   la semana pasada no agrega nada: si el problema sigue, ya hay un aviso
 *   nuevo, y si se resolvió, el viejo miente.
 * - Un **hecho** ("te asignaron X", "te mencionaron") pasó una sola vez y no se
 *   repite. Ese sí espera a que lo lean, pero tampoco para siempre.
 *
 * Módulo PURO: entra un aviso y la fecha, sale si se borra.
 */

/** Avisos que el cron vuelve a generar todos los días. */
export const TIPOS_REGENERABLES = ["vencida", "proxima_a_vencer", "recordatorio"];

/** Días que vive un recordatorio sin leer antes de que lo reemplace el del día. */
export const DIAS_REGENERABLE = 7;
/** Días que vive un hecho sin leer (asignación, mención, comentario). */
export const DIAS_HECHO = 30;
/** Días que vive un aviso ya leído. */
export const DIAS_LEIDO = 60;

export interface AvisoParaHigiene {
  tipo: string;
  leida: boolean;
  /** ISO. */
  created_at: string;
}

/** Cuántos días pasaron entre dos instantes ISO. */
function diasDesde(iso: string, ahora: string): number {
  return (Date.parse(ahora) - Date.parse(iso)) / 86_400_000;
}

/**
 * ¿Este aviso ya no sirve?
 *
 * Nunca borra algo del día: un aviso de esta mañana sin leer es justamente el
 * que hay que leer.
 */
export function avisoVencido(aviso: AvisoParaHigiene, ahora: string): boolean {
  const dias = diasDesde(aviso.created_at, ahora);
  if (dias < 1) return false;
  if (aviso.leida) return dias > DIAS_LEIDO;
  if (TIPOS_REGENERABLES.includes(aviso.tipo)) return dias > DIAS_REGENERABLE;
  return dias > DIAS_HECHO;
}

export interface CorteDeHigiene {
  /** Borrar los leídos anteriores a esta fecha ISO. */
  leidosAntesDe: string;
  /** Borrar los recordatorios sin leer anteriores a esta fecha ISO. */
  regenerablesAntesDe: string;
  /** Borrar los hechos sin leer anteriores a esta fecha ISO. */
  hechosAntesDe: string;
  tiposRegenerables: string[];
}

/** Las tres fechas de corte, para armar los DELETE de una. */
export function cortesDeHigiene(ahora: Date = new Date()): CorteDeHigiene {
  const menos = (d: number) => new Date(ahora.getTime() - d * 86_400_000).toISOString();
  return {
    leidosAntesDe: menos(DIAS_LEIDO),
    regenerablesAntesDe: menos(DIAS_REGENERABLE),
    hechosAntesDe: menos(DIAS_HECHO),
    tiposRegenerables: TIPOS_REGENERABLES,
  };
}
