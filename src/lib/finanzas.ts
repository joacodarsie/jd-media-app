import type { ExchangeRates } from "./exchange";

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

export function toARS(monto: number, moneda: string, rates: ExchangeRates): number {
  const tasa = moneda === "USD" ? rates.USD : moneda === "EUR" ? rates.EUR : 1;
  return monto * tasa;
}

export function fmtARS(n: number): string {
  return `ARS ${Math.round(n).toLocaleString("es-AR")}`;
}

export function fmtCurrency(monto: number, moneda: string): string {
  return `${moneda} ${Math.round(monto).toLocaleString("es-AR")}`;
}

export function isOverdue(fechaVencimiento: string | null, fechaCobro: string | null): boolean {
  if (fechaCobro) return false;
  if (!fechaVencimiento) return false;
  const today = new Date().toISOString().slice(0, 10);
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
