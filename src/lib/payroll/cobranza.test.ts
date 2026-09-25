import { describe, it, expect } from "vitest";
import { calcularCobranza, cobradaEnFecha, pctCoordGeneral } from "./cobranza";

describe("cobradaEnFecha", () => {
  it("cuenta del 1 al 5 del mes del período", () => {
    expect(cobradaEnFecha("2026-10-01", "2026-10")).toBe(true);
    expect(cobradaEnFecha("2026-10-05", "2026-10")).toBe(true);
  });
  it("marcada el 6 o después, no cuenta", () => {
    expect(cobradaEnFecha("2026-10-06", "2026-10")).toBe(false);
    expect(cobradaEnFecha("2026-10-11", "2026-10")).toBe(false);
  });
  it("ni sin marcar, ni de otro mes", () => {
    expect(cobradaEnFecha(null, "2026-10")).toBe(false);
    expect(cobradaEnFecha("2026-09-30", "2026-10")).toBe(false);
    expect(cobradaEnFecha("2026-11-02", "2026-10")).toBe(false);
  });
});

describe("pctCoordGeneral", () => {
  it("hasta septiembre, el 5% de antes; desde octubre, el de hoy", () => {
    expect(pctCoordGeneral("2026-09", 0.02)).toBe(0.05);
    expect(pctCoordGeneral("2026-10", 0.02)).toBe(0.02);
  });
});

describe("calcularCobranza", () => {
  it("2% de lo cobrado en fecha, y cuenta cuántas entraron", () => {
    const r = calcularCobranza(
      [
        { cliente_id: "a", monto: "350000.00", fecha_cobro: "2026-10-03" },
        { cliente_id: "b", monto: 400000, fecha_cobro: "2026-10-05" },
        { cliente_id: "c", monto: 300000, fecha_cobro: "2026-10-11" },
        { cliente_id: "d", monto: 250000, fecha_cobro: null },
      ],
      "2026-10",
      0.02
    );
    expect(r).toEqual({ base: 750000, enFecha: 2, total: 4, monto: 15000 });
  });

  it("una factura en dólares no se suma como pesos", () => {
    const r = calcularCobranza(
      [{ cliente_id: "a", monto: 500, moneda: "USD", fecha_cobro: "2026-10-02" }],
      "2026-10",
      0.02
    );
    expect(r.monto).toBe(0);
    expect(r.total).toBe(0);
  });
});
