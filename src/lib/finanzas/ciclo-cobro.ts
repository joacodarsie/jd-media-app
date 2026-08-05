/**
 * Ciclo de cobro de los abonos mensuales.
 *
 * Política vigente (2026-08): el abono de cada mes se cobra en la ventana que
 * va del **25 del mes anterior al 1º del mes que se abona**.
 *
 * El motivo no es administrativo: los sueldos del equipo se pagan el **5 de
 * cada mes**, así que la plata tiene que estar cobrada antes. Cobrar el día 10
 * (como estaba) dejaba la caja corta justo cuando había que pagar.
 *
 * Antes: cada contrato tenía su `contrato_dia_cobro` (el "Nº día hábil") y las
 * facturas vencían el 10. Ahora la ventana es la misma para todos; el campo
 * `contrato_dia_cobro` queda en la base por los contratos ya firmados, pero no
 * decide nada nuevo.
 *
 * Este módulo es la ÚNICA fuente de verdad: la carta acuerdo, las facturas, el
 * recordatorio automático y los mensajes al cliente leen de acá.
 */

/** Día del mes anterior en que se abre la ventana de cobro. */
export const COBRO_DESDE_DIA = 25;

/** Día del mes abonado en que cierra la ventana (vencimiento). */
export const COBRO_HASTA_DIA = 1;

/** Día en que se pagan los sueldos — el motivo de que la ventana sea esa. */
export const SUELDOS_DIA = 5;

/** Frase para la carta acuerdo y los mensajes al cliente. */
export const VENTANA_COBRO_TEXTO = `entre el ${COBRO_DESDE_DIA} del mes anterior y el ${COBRO_HASTA_DIA}º del mes a abonar`;

/** Versión corta, para recordatorios de WhatsApp. */
export const VENTANA_COBRO_CORTO = `del ${COBRO_DESDE_DIA} al ${COBRO_HASTA_DIA}`;

/**
 * Vencimiento de la factura de un período: el 1º del mes que se abona.
 * `periodo` en formato YYYY-MM.
 */
export function vencimientoDePeriodo(periodo: string): string {
  return `${periodo}-${String(COBRO_HASTA_DIA).padStart(2, "0")}`;
}

/**
 * ¿Hoy hay que mandar el recordatorio de cobro?
 *
 * Se manda UNA vez, el día 25, que es cuando abre la ventana. No mandamos todos
 * los días de la ventana: sería spam y el cliente deja de leerlos.
 *
 * @param hoyYmd fecha "YYYY-MM-DD"
 */
export function esDiaDeRecordatorio(hoyYmd: string): boolean {
  const dia = Number(hoyYmd.slice(8, 10));
  return dia === COBRO_DESDE_DIA;
}

/**
 * Qué período se está cobrando en una fecha dada.
 *
 * Del 25 en adelante se cobra el mes SIGUIENTE (por adelantado); del 1 al 24 se
 * está cobrando el mes en curso (a los que pagaron tarde).
 *
 * @param hoyYmd fecha "YYYY-MM-DD" → devuelve "YYYY-MM"
 */
export function periodoQueSeCobra(hoyYmd: string): string {
  const [y, m, d] = hoyYmd.split("-").map(Number);
  if (d < COBRO_DESDE_DIA) return `${y}-${String(m).padStart(2, "0")}`;
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * ¿La factura de este período está vencida a la fecha dada?
 * Vence el 1º del mes abonado.
 */
export function estaVencido(periodo: string, hoyYmd: string): boolean {
  return hoyYmd > vencimientoDePeriodo(periodo);
}
