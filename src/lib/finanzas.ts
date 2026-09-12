import { hoyYmd } from "@/lib/dates";

import type { ExchangeRates } from "./exchange";

/**
 * El mes en curso, "YYYY-MM", en la zona de la agencia (Córdoba).
 *
 * Iba con `new Date().getMonth()`, que en Vercel corre en UTC: el 31 a la noche
 * el mes ya cambiaba y toda la pantalla de finanzas se iba al mes siguiente.
 */
export function currentPeriod(): string {
  return hoyYmd().slice(0, 7);
}

export function nextPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function prevPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Rango de un mes como [primer día, primer día del mes siguiente) — exclusivo.
 * Evita armar fechas inválidas tipo "2026-06-31" (junio tiene 30 días) que hacen
 * fallar las consultas a columnas `date` en Postgres. `mes` = YYYY-MM.
 */
export function monthRange(mes: string): { start: string; endExclusive: string } {
  return { start: `${mes}-01`, endExclusive: `${nextPeriod(mes)}-01` };
}

export function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/**
 * Pasa un monto a pesos.
 *
 * Los dólares van SIEMPRE al cripto/USDC, que es la cotización de Dólar App —
 * la aplicación con la que el dueño paga todo lo que está en dólares. Antes
 * esto usaba el blue y los costos en USD salían ~4% baratos de lo que cuestan
 * de verdad: una diferencia chica por línea que igual ensucia el margen de
 * todas las cuentas cuando se prorratea la estructura.
 */
export function toARS(monto: number, moneda: string, rates: ExchangeRates): number {
  const tasa = moneda === "USD" ? rates.USDC : moneda === "EUR" ? rates.EUR : 1;
  return monto * tasa;
}

/**
 * @deprecated Quedó como alias de `toARS`: la distinción entre "dólar de los
 * fijos" y "dólar de todo lo demás" desapareció cuando se unificó todo en el de
 * Dólar App. Se mantiene para no tocar los ~7 lugares que ya lo llamaban.
 */
export const toARSFijos = toARS;

export function fmtARS(n: number): string {
  return `ARS ${Math.round(n).toLocaleString("es-AR")}`;
}

export function fmtCurrency(monto: number, moneda: string): string {
  return `${moneda} ${Math.round(monto).toLocaleString("es-AR")}`;
}

export function isOverdue(fechaVencimiento: string | null, fechaCobro: string | null): boolean {
  if (fechaCobro) return false;
  if (!fechaVencimiento) return false;
  const today = hoyYmd();
  return fechaVencimiento < today;
}

/**
 * Días (enteros) desde hoy hasta `fecha` (YYYY-MM-DD). 0 = hoy, negativo = ya
 * pasó (atraso), positivo = faltan días. `null` si no hay fecha. Compara a
 * medianoche local para que no dependa de la hora del día.
 */
export function daysUntil(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
