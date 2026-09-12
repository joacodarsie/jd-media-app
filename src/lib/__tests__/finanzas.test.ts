import { describe, it, expect } from "vitest";
import {
  toARS,
  toARSFijos,
  isOverdue,
  nextPeriod,
  prevPeriod,
  monthRange,
  daysUntil,
} from "@/lib/finanzas";

const rates = {
  // USD es el blue: NO se usa para convertir. Queda distinto de USDC a propósito
  // para que el test falle si alguien vuelve a convertir dólares con el blue.
  USD: 1000,
  EUR: 1100,
  USDC: 1200,
  source: "fallback" as const,
  fetchedAt: "2026-06-16T00:00:00.000Z",
};

describe("toARS", () => {
  it("los dólares van al de Dólar App (USDC), no al blue", () => {
    // Es la aplicación con la que el dueño paga todo lo que está en dólares.
    expect(toARS(100, "USD", rates)).toBe(120_000);
    expect(toARS(100, "EUR", rates)).toBe(110_000);
    expect(toARS(100, "ARS", rates)).toBe(100);
    expect(toARS(100, "lo-que-sea", rates)).toBe(100); // desconocida → ARS
  });

  it("toARSFijos quedó como alias: los dos dólares son el mismo", () => {
    expect(toARSFijos(100, "USD", rates)).toBe(toARS(100, "USD", rates));
  });
});

describe("isOverdue", () => {
  it("vencida si pasó la fecha y no se cobró", () => {
    expect(isOverdue("2000-01-01", null)).toBe(true);
  });
  it("NO vencida si ya se cobró, aunque la fecha haya pasado", () => {
    expect(isOverdue("2000-01-01", "2000-02-01")).toBe(false);
  });
  it("NO vencida si la fecha es futura", () => {
    expect(isOverdue("2999-01-01", null)).toBe(false);
  });
  it("NO vencida si no hay fecha de vencimiento", () => {
    expect(isOverdue(null, null)).toBe(false);
  });
});

describe("daysUntil", () => {
  const iso = (offsetDays: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  it("hoy = 0", () => {
    expect(daysUntil(iso(0))).toBe(0);
  });
  it("futuro = positivo, pasado = negativo", () => {
    expect(daysUntil(iso(5))).toBe(5);
    expect(daysUntil(iso(-3))).toBe(-3);
  });
  it("acepta timestamp y toma solo la fecha", () => {
    expect(daysUntil(iso(2) + "T23:59:59Z")).toBe(2);
  });
  it("null/inválido → null", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil("")).toBeNull();
  });
});

describe("nextPeriod / prevPeriod", () => {
  it("avanza de mes y cruza el año", () => {
    expect(nextPeriod("2026-06")).toBe("2026-07");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
  it("retrocede de mes y cruza el año", () => {
    expect(prevPeriod("2026-07")).toBe("2026-06");
    expect(prevPeriod("2026-01")).toBe("2025-12");
  });
});

describe("monthRange (el bug del 2026-06-31)", () => {
  it("usa el primer día del mes siguiente como fin exclusivo (nunca día 31 inválido)", () => {
    expect(monthRange("2026-06")).toEqual({
      start: "2026-06-01",
      endExclusive: "2026-07-01",
    });
    // Febrero: jamás debe generar 2026-02-30/31.
    expect(monthRange("2026-02")).toEqual({
      start: "2026-02-01",
      endExclusive: "2026-03-01",
    });
    // Diciembre cruza el año.
    expect(monthRange("2026-12")).toEqual({
      start: "2026-12-01",
      endExclusive: "2027-01-01",
    });
  });

  it("ningún mes produce un día de fin > 01 (regresión del bug)", () => {
    for (let m = 1; m <= 12; m++) {
      const mes = `2026-${String(m).padStart(2, "0")}`;
      const { endExclusive } = monthRange(mes);
      expect(endExclusive.endsWith("-01")).toBe(true);
    }
  });
});
