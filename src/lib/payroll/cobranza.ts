/**
 * La comisión de Leo por la COBRANZA (acuerdo de rol, septiembre 2026; vigente
 * desde el período 2026-10, que se paga el 7 de noviembre).
 *
 * Leo cobra un % de lo que pagan los clientes, pero solo de lo que queda
 * MARCADO como cobrado entre el 1 y el 5 del mes. Es a propósito: la agencia
 * cobra del 1 al 5 y durante meses los cobros se marcaban juntos días después
 * (el 11/9 se marcaron diez de una vez), así que ningún número de plata era
 * confiable. Lo que no está marcado en fecha no cuenta.
 *
 * Hasta septiembre se pagaba otra cosa: un % de toda la facturación (salvo las
 * cuentas con precio personalizado). Esa línea sigue en `payroll-period.ts`
 * para los meses viejos.
 *
 * Puro: entra data, sale la línea.
 */

/** Primer período con la regla nueva. */
export const COBRANZA_DESDE = "2026-10";

/** Lo que se pagaba hasta septiembre (5% de la facturación). */
export const COORD_GENERAL_HASTA_SEPTIEMBRE = 0.05;

/** Último día del mes que cuenta como "en fecha". */
export const DIA_LIMITE_COBRO = 5;

export interface FacturaCobrada {
  cliente_id: string;
  monto: number | string | null;
  moneda?: string | null;
  fecha_cobro: string | null;
}

/** % de la coordinación general según el período (los meses viejos con el suyo). */
export function pctCoordGeneral(periodo: string, rateActual: number): number {
  return periodo < COBRANZA_DESDE ? COORD_GENERAL_HASTA_SEPTIEMBRE : rateActual;
}

/** ¿Se marcó cobrada entre el 1 y el 5 del mes del período? */
export function cobradaEnFecha(fechaCobro: string | null, periodo: string): boolean {
  if (!fechaCobro || fechaCobro.slice(0, 7) !== periodo) return false;
  return Number(fechaCobro.slice(8, 10)) <= DIA_LIMITE_COBRO;
}

export interface Cobranza {
  /** Suma en pesos de las facturas del período cobradas del 1 al 5. */
  base: number;
  enFecha: number;
  total: number;
  monto: number;
}

/**
 * Las facturas en otra moneda no suman: el % es sobre pesos y hoy todas las
 * facturas son en pesos. Si aparece una en dólares queda afuera en vez de
 * sumarse como si fueran pesos.
 */
export function calcularCobranza(facturas: FacturaCobrada[], periodo: string, pct: number): Cobranza {
  const enPesos = facturas.filter((f) => (f.moneda ?? "ARS") === "ARS");
  const enFecha = enPesos.filter((f) => cobradaEnFecha(f.fecha_cobro, periodo));
  const base = enFecha.reduce((s, f) => s + (Number(f.monto) || 0), 0);
  return { base, enFecha: enFecha.length, total: enPesos.length, monto: Math.round(base * pct) };
}
