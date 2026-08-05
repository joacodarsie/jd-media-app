import { describe, it, expect } from "vitest";
import { calcularPrimerMes } from "./primer-mes";

describe("calcularPrimerMes", () => {
  it("arrancando el día 1 se cobra el mes completo, sin prorratear", () => {
    const r = calcularPrimerMes(400_000, "2026-08-01");
    expect(r.esProporcional).toBe(false);
    expect(r.montoEsteMes).toBe(400_000);
    expect(r.diasRestantes).toBe(31);
  });

  it("cuenta el día de inicio como cobrado", () => {
    // Del 5 al 31 de agosto son 27 días, no 26.
    const r = calcularPrimerMes(400_000, "2026-08-05");
    expect(r.diasRestantes).toBe(27);
    expect(r.diasMes).toBe(31);
    expect(r.montoEsteMes).toBe(Math.round((400_000 / 31) * 27)); // 348.387
  });

  it("el caso real del cliente: $400.000 arrancando el 05/08", () => {
    expect(calcularPrimerMes(400_000, "2026-08-05").montoEsteMes).toBe(348_387);
  });

  it("arrancando el último día se cobra un solo día", () => {
    const r = calcularPrimerMes(400_000, "2026-08-31");
    expect(r.diasRestantes).toBe(1);
    expect(r.montoEsteMes).toBe(Math.round(400_000 / 31));
  });

  it("usa los días reales de cada mes, no 30 fijo", () => {
    expect(calcularPrimerMes(300_000, "2026-02-15").diasMes).toBe(28);
    expect(calcularPrimerMes(300_000, "2026-04-15").diasMes).toBe(30);
    // 2028 es bisiesto.
    expect(calcularPrimerMes(300_000, "2028-02-15").diasMes).toBe(29);
  });

  it("sin fecha de inicio no inventa un prorrateo", () => {
    const r = calcularPrimerMes(400_000, null);
    expect(r.esProporcional).toBe(false);
    expect(r.montoEsteMes).toBe(400_000);
  });

  it("una fecha con formato raro tampoco prorratea", () => {
    expect(calcularPrimerMes(400_000, "05/08/2026").esProporcional).toBe(false);
    expect(calcularPrimerMes(400_000, "").montoEsteMes).toBe(400_000);
  });

  it("nunca devuelve un monto negativo ni NaN", () => {
    expect(calcularPrimerMes(-500, "2026-08-05").montoEsteMes).toBe(0);
    expect(calcularPrimerMes(NaN, "2026-08-05").montoEsteMes).toBe(0);
  });

  it("el proporcional nunca supera el mensual", () => {
    for (const dia of ["01", "07", "15", "23", "31"]) {
      const r = calcularPrimerMes(400_000, `2026-08-${dia}`);
      expect(r.montoEsteMes).toBeLessThanOrEqual(400_000);
      expect(r.montoEsteMes).toBeGreaterThan(0);
    }
  });
});
