/**
 * Costo mensual de una suscripción (21/10/2026). Vivía dentro de
 * subscriptions-manager.tsx ("use client") y la página de Gastos (server) la
 * importaba de ahí: en el servidor llegaba como referencia de cliente y la
 * vista Suscripciones se rompía con «x is not a function».
 */
const DIVISOR: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

/** Costo normalizado a mensual, en la moneda de la suscripción. */
export function costoMensual(s: { costo: number; ciclo: string }): number {
  return s.costo / (DIVISOR[s.ciclo] ?? 1);
}
