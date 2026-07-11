import { describe, it, expect } from "vitest";
import {
  buildFrozenNote,
  parseFrozenNote,
  stripFrozenNote,
  appendFrozenNote,
  freezeExpense,
  expenseRate,
} from "../finanzas/fx";
import type { ExchangeRates } from "../exchange";

const rates: ExchangeRates = {
  USD: 1500,
  EUR: 1650,
  USDC: 1562.5,
  source: "live",
  fetchedAt: "2026-07-11",
};

describe("expenseRate", () => {
  it("USD usa el cripto, EUR el euro, ARS no convierte", () => {
    expect(expenseRate("USD", rates)).toBe(1562.5);
    expect(expenseRate("EUR", rates)).toBe(1650);
    expect(expenseRate("ARS", rates)).toBeNull();
  });
});

describe("freezeExpense + parseFrozenNote (ida y vuelta)", () => {
  it("congela un gasto USD al cripto y el marcador se puede leer", () => {
    const f = freezeExpense(14, "USD", null, rates, "2026-07-11")!;
    expect(f.montoARS).toBe(Math.round(14 * 1562.5)); // 21.875
    expect(f.cotizacion).toBe(1562.5);

    const parsed = parseFrozenNote(f.notas)!;
    expect(parsed).toEqual({
      moneda: "USD",
      montoOriginal: 14,
      cotizacion: 1562.5,
      fecha: "2026-07-11",
    });
  });

  it("conserva las notas previas del gasto", () => {
    const f = freezeExpense(20, "USD", "Plan anual", rates, "2026-07-11")!;
    expect(f.notas).toContain("Plan anual");
    expect(parseFrozenNote(f.notas)?.montoOriginal).toBe(20);
  });

  it("un gasto en ARS no se congela", () => {
    expect(freezeExpense(40000, "ARS", null, rates, "2026-07-11")).toBeNull();
  });
});

describe("stripFrozenNote (al des-pagar)", () => {
  it("saca el marcador y deja las notas originales", () => {
    const marker = buildFrozenNote("USD", 14, 1562.5, "2026-07-11");
    expect(stripFrozenNote(appendFrozenNote("Plan anual", marker))).toBe("Plan anual");
    expect(stripFrozenNote(appendFrozenNote(null, marker))).toBeNull();
  });

  it("no toca notas sin marcador", () => {
    expect(stripFrozenNote("nota común")).toBe("nota común");
    expect(stripFrozenNote(null)).toBeNull();
  });
});
