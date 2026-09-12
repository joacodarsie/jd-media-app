import { describe, it, expect } from "vitest";
import { planDeCierre, fechaDeCierre, type PersonaParaCerrar } from "./cierre-mes";

const gasto = (id: string, montoARS: number) => ({ id, concepto: "Canva — 2026-09", montoARS });

const persona = (over: Partial<PersonaParaCerrar> = {}): PersonaParaCerrar => ({
  userId: "u1",
  nombre: "Luz",
  total: 300_000,
  registrado: false,
  ...over,
});

describe("planDeCierre", () => {
  it("incluye a quien no tiene el sueldo registrado", () => {
    const plan = planDeCierre({
      personas: [persona()],
      gastosPendientes: [gasto("g1", 663_759)],
    });
    expect(plan.pagos).toHaveLength(1);
    expect(plan.totalEquipo).toBe(300_000);
    expect(plan.totalGastos).toBe(663_759);
    expect(plan.gastosIds).toEqual(["g1"]);
    expect(plan.nadaQueHacer).toBe(false);
  });

  it("deja afuera a quien ya cobró", () => {
    const plan = planDeCierre({
      personas: [persona({ registrado: true, fechaPago: "2026-09-30" })],
      gastosPendientes: [],
    });
    expect(plan.pagos).toHaveLength(0);
    expect(plan.nadaQueHacer).toBe(true);
  });

  it("un pago parcial entra por el TOTAL: sellar la fecha dice que se pagó todo", () => {
    const plan = planDeCierre({
      personas: [persona({ total: 879_300, registrado: true, montoPagado: 679_300 })],
      gastosPendientes: [],
    });
    expect(plan.pagos[0].monto).toBe(879_300);
  });

  it("no registra pagos de $0", () => {
    const plan = planDeCierre({
      personas: [persona({ total: 0 })],
      gastosPendientes: [],
    });
    expect(plan.pagos).toHaveLength(0);
    expect(plan.nadaQueHacer).toBe(true);
  });

  it("si los gastos fijos ya están sellados, no hay nada que marcar", () => {
    const plan = planDeCierre({
      personas: [],
      gastosPendientes: [],
    });
    expect(plan.totalGastos).toBe(0);
  });

  it("sin gastos pendientes no inventa nada", () => {
    const plan = planDeCierre({ personas: [], gastosPendientes: [] });
    expect(plan.totalGastos).toBe(0);
    expect(plan.nadaQueHacer).toBe(true);
  });

  it("suma el equipo de todo el mes", () => {
    const plan = planDeCierre({
      personas: [
        persona({ userId: "a", total: 300_000 }),
        persona({ userId: "b", total: 150_500 }),
        persona({ userId: "c", total: 200_000, registrado: true, fechaPago: "2026-09-01" }),
      ],
      gastosPendientes: [],
    });
    expect(plan.pagos.map((p) => p.userId)).toEqual(["a", "b"]);
    expect(plan.totalEquipo).toBe(450_500);
  });
});

describe("fechaDeCierre", () => {
  it("el mes en curso se sella hoy", () => {
    expect(fechaDeCierre("2026-09", "2026-09-12")).toBe("2026-09-12");
  });

  it("🔴 un mes ya cerrado se sella el último día de ESE mes, no hoy", () => {
    // Si no, el gasto de julio se contaría en septiembre y descuadraría los dos.
    expect(fechaDeCierre("2026-07", "2026-09-12")).toBe("2026-07-31");
  });

  it("resuelve bien los meses de 30 días y febrero", () => {
    expect(fechaDeCierre("2026-04", "2026-09-12")).toBe("2026-04-30");
    expect(fechaDeCierre("2026-02", "2026-09-12")).toBe("2026-02-28");
    expect(fechaDeCierre("2024-02", "2026-09-12")).toBe("2024-02-29");
  });
});
