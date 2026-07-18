/**
 * Reparto de una jornada de producción. Modelo (desde 2026-06; precios FNA
 * 2026-07):
 *  - PRECIO al cliente: $50.000 la hora de producción (van 2 personas con
 *    micrófonos, celulares y guiones a grabar el contenido del mes) +
 *    $25.000 por cada hora extra + viáticos.
 *  - El default de $75.000 = 1 hora ($50.000) + viáticos ($25.000). Si la
 *    jornada dura más, se edita el monto: total = 50.000 + 25.000×(horas−1)
 *    + viáticos.
 *  - 25.000 son viáticos, repartidos en partes iguales entre quienes van.
 *  - El resto (total - viáticos) se reparte: 50% quien dirige, 30% el
 *    acompañante, 20% la agencia.
 *  - Se cobra al finalizar la jornada.
 *
 * En `production_sessions.asistentes`, por convención: [0] = director/a,
 * [1] = acompañante (opcional). No necesita columnas nuevas.
 */
export const JORNADA_PRECIO_HORA = 50000;
export const JORNADA_PRECIO_HORA_EXTRA = 25000;
export const JORNADA_VIATICOS = 25000;
export const JORNADA_MONTO_DEFAULT = 75000;
export const JORNADA_PCT_DIRECTOR = 0.5;
export const JORNADA_PCT_ACOMPANANTE = 0.3;
export const JORNADA_PCT_AGENCIA = 0.2;

export interface JornadaSplit {
  viaticosPorPersona: number;
  director: number;
  acompanante: number | null;
  agencia: number;
}

/** Calcula el reparto de una jornada según su monto total y si hay acompañante. */
export function computeJornadaSplit(monto: number, hasAcompanante: boolean): JornadaSplit {
  const m = Number.isFinite(monto) ? monto : 0;
  const numPersonas = hasAcompanante ? 2 : 1;
  const viaticosPorPersona = Math.round(Math.min(JORNADA_VIATICOS, m) / numPersonas);
  const resto = Math.max(0, m - JORNADA_VIATICOS);
  const director = viaticosPorPersona + Math.round(resto * JORNADA_PCT_DIRECTOR);
  const acompanante = hasAcompanante
    ? viaticosPorPersona + Math.round(resto * JORNADA_PCT_ACOMPANANTE)
    : null;
  const agencia = m - director - (acompanante ?? 0);
  return { viaticosPorPersona, director, acompanante, agencia };
}
