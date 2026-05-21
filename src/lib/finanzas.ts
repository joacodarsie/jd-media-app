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
