// Congelado de gastos en moneda extranjera al momento del PAGO.
//
// Un gasto en USD flota (se estima al dólar del día) mientras está pendiente.
// Al pagarlo, se fija: el monto se convierte a ARS con el DÓLAR CRIPTO de ese
// día (es como la agencia paga sus suscripciones) y la fila queda en ARS para
// siempre — así Movimientos, Registro y Rentabilidad no cambian con el dólar.
// El original + la cotización quedan anotados en `notas` con un marcador
// parseable, lo que permite revertir el pago restaurando el monto original.

import type { ExchangeRates } from "@/lib/exchange";

export interface FrozenFx {
  moneda: string; // USD | EUR
  montoOriginal: number;
  cotizacion: number;
  fecha: string; // YYYY-MM-DD
}

/** Marcador que se agrega a notas al congelar: legible y parseable. */
const FROZEN_RE = /Pagado (USD|EUR) ([\d.]+) @ \$([\d.]+) \((\d{4}-\d{2}-\d{2})\)/;

/** Cotización que corresponde a la moneda de un gasto: USD → cripto/USDC. */
export function expenseRate(moneda: string, rates: ExchangeRates): number | null {
  if (moneda === "USD") return rates.USDC;
  if (moneda === "EUR") return rates.EUR;
  return null; // ARS u otra: no se convierte
}

/** Texto que se anexa a notas al congelar el pago. */
export function buildFrozenNote(moneda: string, montoOriginal: number, cotizacion: number, fecha: string): string {
  return `Pagado ${moneda} ${montoOriginal} @ $${cotizacion} (${fecha})`;
}

/** Extrae el congelado del texto de notas (null si no hay). */
export function parseFrozenNote(notas: string | null): FrozenFx | null {
  const m = notas?.match(FROZEN_RE);
  if (!m) return null;
  const montoOriginal = Number(m[2]);
  const cotizacion = Number(m[3]);
  if (!Number.isFinite(montoOriginal) || !Number.isFinite(cotizacion)) return null;
  return { moneda: m[1], montoOriginal, cotizacion, fecha: m[4] };
}

/** Saca el marcador de notas (al des-pagar). Devuelve null si queda vacío. */
export function stripFrozenNote(notas: string | null): string | null {
  if (!notas) return null;
  const out = notas
    .replace(FROZEN_RE, "")
    .replace(/\s*·\s*$/, "")
    .replace(/^\s*·\s*/, "")
    .trim();
  return out || null;
}

/** Anexa el marcador a las notas existentes. */
export function appendFrozenNote(notas: string | null, marker: string): string {
  return notas?.trim() ? `${notas.trim()} · ${marker}` : marker;
}

/**
 * Calcula el congelado de un gasto no-ARS: monto fijo en ARS + notas nuevas.
 * Devuelve null si el gasto ya está en ARS (no hay nada que congelar).
 */
export function freezeExpense(
  monto: number,
  moneda: string,
  notas: string | null,
  rates: ExchangeRates,
  fecha: string
): { montoARS: number; notas: string; cotizacion: number } | null {
  const rate = expenseRate(moneda, rates);
  if (rate == null) return null;
  const cotizacion = Math.round(rate * 100) / 100;
  return {
    montoARS: Math.round(monto * cotizacion),
    cotizacion,
    notas: appendFrozenNote(notas, buildFrozenNote(moneda, monto, cotizacion, fecha)),
  };
}
