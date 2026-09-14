/**
 * Ciclo de cobro de los abonos mensuales.
 *
 * Política vigente (desde el 15/9/2026): el abono de cada mes se cobra **por
 * adelantado, del 1 al 5 del mes que se abona**.
 *
 * El motivo: los sueldos del equipo se pagan a mes vencido **el día 7**, así que
 * cobrando hasta el 5 la plata ya entró antes de tener que pagar. Es el
 * calendario de la agencia: del 1 al 5 cobra, el 7 paga.
 *
 * Historia: hasta julio de 2026 cada contrato tenía su `contrato_dia_cobro` y
 * las facturas vencían el 10. En agosto se pasó a una ventana del 25 del mes
 * anterior al 1º, porque los sueldos se pagaban el 5. Con los sueldos el 7, la
 * ventana volvió al mes abonado. `contrato_dia_cobro` queda en la base por los
 * contratos ya firmados, pero no decide nada.
 *
 * Este módulo es la ÚNICA fuente de verdad: la carta acuerdo, las facturas, el
 * recordatorio automático y los mensajes al cliente leen de acá.
 */

/** Día del mes abonado en que se abre la ventana de cobro. */
export const COBRO_DESDE_DIA = 1;

/** Día del mes abonado en que cierra la ventana (vencimiento). */
export const COBRO_HASTA_DIA = 5;

/** Día en que se pagan los sueldos — el motivo de que la ventana cierre antes. */
export const SUELDOS_DIA = 7;

/** Frase para la carta acuerdo y los mensajes al cliente. */
export const VENTANA_COBRO_TEXTO = `entre el ${COBRO_DESDE_DIA} y el ${COBRO_HASTA_DIA} de cada mes`;

/** Versión corta, para recordatorios de WhatsApp. */
export const VENTANA_COBRO_CORTO = `del ${COBRO_DESDE_DIA} al ${COBRO_HASTA_DIA}`;

/**
 * Vencimiento de la factura de un período: el día 5 del mes que se abona.
 * `periodo` en formato YYYY-MM.
 */
export function vencimientoDePeriodo(periodo: string): string {
  return `${periodo}-${String(COBRO_HASTA_DIA).padStart(2, "0")}`;
}

/**
 * ¿Hoy hay que mandar el recordatorio de cobro?
 *
 * Se manda UNA vez, el día 1, que es cuando abre la ventana. No mandamos todos
 * los días de la ventana: sería spam y el cliente deja de leerlos.
 *
 * @param hoyYmd fecha "YYYY-MM-DD"
 */
export function esDiaDeRecordatorio(hoyYmd: string): boolean {
  const dia = Number(hoyYmd.slice(8, 10));
  return dia === COBRO_DESDE_DIA;
}

/**
 * Qué período se está cobrando en una fecha dada: siempre el mes en curso,
 * porque se cobra por adelantado dentro del mismo mes.
 *
 * @param hoyYmd fecha "YYYY-MM-DD" → devuelve "YYYY-MM"
 */
export function periodoQueSeCobra(hoyYmd: string): string {
  return hoyYmd.slice(0, 7);
}

/**
 * ¿La factura de este período está vencida a la fecha dada?
 * Vence el día 5 del mes abonado.
 */
export function estaVencido(periodo: string, hoyYmd: string): boolean {
  return hoyYmd > vencimientoDePeriodo(periodo);
}
