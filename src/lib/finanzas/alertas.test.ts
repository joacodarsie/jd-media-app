import { describe, it, expect } from "vitest";
import { construirAlertas } from "./alertas";

const aArs = (m: number, moneda: string) => (moneda === "USD" ? m * 1000 : m);
const HOY = "2026-09-12";

describe("construirAlertas", () => {
  it("no devuelve alertas cuando no hay nada atrasado", () => {
    const a = construirAlertas(
      {
        cobros: [{ fecha: "2026-09-30", monto: 100, moneda: "ARS" }],
        pagos: [],
        gastos: [],
      },
      HOY,
      aArs
    );
    expect(a).toEqual([]);
  });

  it("cuenta solo lo vencido y sin saldar", () => {
    const a = construirAlertas(
      {
        cobros: [
          { fecha: "2026-08-01", monto: 300_000, moneda: "ARS" },
          // Vencida pero ya cobrada: no es una alerta.
          { fecha: "2026-08-01", monto: 999_000, moneda: "ARS", fecha_cobro: "2026-08-05" },
          // Todavía no vence.
          { fecha: "2026-09-30", monto: 500_000, moneda: "ARS" },
        ],
        pagos: [],
        gastos: [],
      },
      HOY,
      aArs
    );
    expect(a).toHaveLength(1);
    expect(a[0].cantidad).toBe(1);
    expect(a[0].monto).toBe(300_000);
    expect(a[0].texto).toBe("1 factura vencida sin cobrar");
    expect(a[0].href).toBe("/finanzas/cobros?f=vencidas");
  });

  it("ignora los ítems sin fecha: sin vencimiento no hay atraso", () => {
    const a = construirAlertas(
      { cobros: [{ fecha: null, monto: 400_000, moneda: "ARS" }], pagos: [], gastos: [] },
      HOY,
      aArs
    );
    expect(a).toEqual([]);
  });

  it("lo que vence hoy todavía no está atrasado", () => {
    const a = construirAlertas(
      { cobros: [{ fecha: HOY, monto: 400_000, moneda: "ARS" }], pagos: [], gastos: [] },
      HOY,
      aArs
    );
    expect(a).toEqual([]);
  });

  it("convierte a pesos y pluraliza", () => {
    const a = construirAlertas(
      {
        cobros: [],
        pagos: [
          { fecha: "2026-09-07", monto: 100, moneda: "USD" },
          { fecha: "2026-09-07", monto: 50_000, moneda: "ARS" },
        ],
        gastos: [],
      },
      HOY,
      aArs
    );
    expect(a).toHaveLength(1);
    expect(a[0].monto).toBe(150_000);
    expect(a[0].texto).toBe("2 pagos atrasados al equipo");
  });

  it("junta las tres familias en orden: cobrar, equipo, gastos", () => {
    const a = construirAlertas(
      {
        cobros: [{ fecha: "2026-01-01", monto: 1, moneda: "ARS" }],
        pagos: [{ fecha: "2026-01-01", monto: 2, moneda: "ARS" }],
        gastos: [{ fecha: "2026-01-01", monto: 3, moneda: "ARS" }],
      },
      HOY,
      aArs
    );
    expect(a.map((x) => x.href)).toEqual([
      "/finanzas/cobros?f=vencidas",
      "/finanzas/pagos?f=atrasados",
      "/finanzas/gastos?f=pendientes",
    ]);
  });
});
