import { describe, it, expect } from "vitest";
import { gastosQueFaltaCongelar, type GastoACongelar } from "./congelar-mes";
import { freezeExpense, parseFrozenNote } from "./fx";
import type { ExchangeRates } from "@/lib/exchange";

const g = (x: Partial<GastoACongelar>): GastoACongelar => ({
  id: "x",
  monto: 20,
  moneda: "USD",
  notas: null,
  fecha_pago: "2026-07-31",
  ...x,
});

describe("gastosQueFaltaCongelar", () => {
  it("agarra los pagados que siguen en moneda extranjera", () => {
    expect(gastosQueFaltaCongelar([g({})])).toHaveLength(1);
  });

  it("no toca los que ya están en pesos — por eso se puede correr dos veces", () => {
    // El caso real: el cron del día 1 corre todos los meses sobre los mismos
    // gastos. Si re-congelara, cada corrida multiplicaría el monto por el dólar.
    expect(gastosQueFaltaCongelar([g({ moneda: "ARS", monto: 31_400 })])).toEqual([]);
  });

  it("deja flotando lo que todavía no se pagó", () => {
    // Mientras está pendiente no se sabe a qué dólar se va a pagar: estimarlo
    // al de hoy es lo correcto.
    expect(gastosQueFaltaCongelar([g({ fecha_pago: null })])).toEqual([]);
  });

  it("ignora montos en cero o negativos", () => {
    expect(gastosQueFaltaCongelar([g({ monto: 0 })])).toEqual([]);
  });

  it("trata la moneda vacía como pesos", () => {
    expect(gastosQueFaltaCongelar([g({ moneda: undefined as unknown as string })])).toEqual([]);
  });
});

describe("congelado de un gasto de un mes cerrado", () => {
  const rates = (usdc: number): ExchangeRates => ({
    USD: usdc,
    EUR: 1800,
    USDC: usdc,
    source: "live",
    fetchedAt: "2026-09-12T00:00:00Z",
  });

  it("usa el dólar de la fecha de pago, no el de hoy", () => {
    // Claude JD Media, USD 20, pagado el 31/07 con el cripto de ese día.
    const julio = freezeExpense(20, "USD", null, rates(1569.88), "2026-07-31")!;
    const hoy = freezeExpense(20, "USD", null, rates(1592.62), "2026-07-31")!;
    expect(julio.montoARS).toBe(31_398);
    expect(hoy.montoARS).toBe(31_852);
    // 454 pesos de diferencia en UN gasto de 20 dólares: por eso julio se movía.
    expect(hoy.montoARS - julio.montoARS).toBe(454);
  });

  it("deja anotado el original y la cotización, así se puede auditar", () => {
    const f = freezeExpense(120, "USD", "Pauta propia", rates(1569.88), "2026-07-31")!;
    const leido = parseFrozenNote(f.notas);
    expect(leido).toEqual({
      moneda: "USD",
      montoOriginal: 120,
      cotizacion: 1569.88,
      fecha: "2026-07-31",
    });
    // La nota que ya tenía no se pisa.
    expect(f.notas).toContain("Pauta propia");
  });

  it("un gasto que ya está en pesos no se congela", () => {
    expect(freezeExpense(50_000, "ARS", null, rates(1592), "2026-07-31")).toBeNull();
  });
});
