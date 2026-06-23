import { describe, it, expect } from "vitest";
import { computeJornadaSplit, JORNADA_MONTO_DEFAULT } from "@/lib/jornada";

describe("computeJornadaSplit", () => {
  it("reparte una jornada de 75k con director + acompañante (12.5k viáticos c/u + 50/30/20)", () => {
    const s = computeJornadaSplit(JORNADA_MONTO_DEFAULT, true);
    expect(s.viaticosPorPersona).toBe(12500);
    expect(s.director).toBe(37500); // 12.5k + 50% de 50k
    expect(s.acompanante).toBe(27500); // 12.5k + 30% de 50k
    expect(s.agencia).toBe(10000); // 20% de 50k
    expect(s.director + (s.acompanante ?? 0) + s.agencia).toBe(75000);
  });

  it("con solo director, los viáticos van completos a él y la agencia retiene el resto", () => {
    const s = computeJornadaSplit(75000, false);
    expect(s.viaticosPorPersona).toBe(25000);
    expect(s.director).toBe(50000); // 25k viáticos + 50% de 50k
    expect(s.acompanante).toBeNull();
    expect(s.agencia).toBe(25000);
    expect(s.director + s.agencia).toBe(75000);
  });

  it("nunca reparte de más: la suma siempre cierra con el monto", () => {
    for (const monto of [40000, 60000, 90000, 120000]) {
      for (const hasAcc of [true, false]) {
        const s = computeJornadaSplit(monto, hasAcc);
        expect(s.director + (s.acompanante ?? 0) + s.agencia).toBe(monto);
      }
    }
  });
});
