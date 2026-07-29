/**
 * Tests de los gastos fijos del mes. Lo crítico es que sea IDEMPOTENTE: el cron
 * corre todos los días, así que si duplicara, en una semana el Panorama estaría
 * mostrando siete veces el monotributo.
 */
import { describe, it, expect } from "vitest";
import {
  subsToExpenses,
  conceptoDeSuscripcion,
  type SubscriptionRow,
} from "../finanzas/fixed-expenses";

const sub = (p: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: Math.random().toString(36).slice(2),
  nombre: "Canva",
  categoria: "plataformas",
  costo: 12000,
  moneda: "ARS",
  ciclo: "mensual",
  activa: true,
  ...p,
});

describe("subsToExpenses", () => {
  it("arma un gasto por suscripción mensual activa", () => {
    const r = subsToExpenses(
      [sub(), sub({ nombre: "Monotributo", categoria: "impuestos", costo: 40000 })],
      "2026-07",
      []
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      concepto: "Canva — 2026-07",
      monto: 12000,
      moneda: "ARS",
      categoria: "plataformas",
      recurrente: true,
    });
  });

  it("respeta la moneda original (los USD no se convierten acá)", () => {
    const r = subsToExpenses([sub({ nombre: "Claude", costo: 20, moneda: "USD" })], "2026-07", []);
    expect(r[0].moneda).toBe("USD");
    expect(r[0].monto).toBe(20);
  });

  it("NO duplica lo que ya se creó este mes", () => {
    const r = subsToExpenses([sub()], "2026-07", ["Canva — 2026-07"]);
    expect(r).toHaveLength(0);
  });

  it("la deduplicación no se rompe por mayúsculas ni espacios", () => {
    const r = subsToExpenses([sub()], "2026-07", ["  canva — 2026-07  "]);
    expect(r).toHaveLength(0);
  });

  it("el mes siguiente sí se vuelve a crear", () => {
    const r = subsToExpenses([sub()], "2026-08", ["Canva — 2026-07"]);
    expect(r).toHaveLength(1);
  });

  it("ignora las inactivas, las anuales y las que no tienen costo", () => {
    const r = subsToExpenses(
      [
        sub({ nombre: "Vieja", activa: false }),
        sub({ nombre: "Anual", ciclo: "anual" }),
        sub({ nombre: "Sin costo", costo: null }),
        sub({ nombre: "En cero", costo: 0 }),
      ],
      "2026-07",
      []
    );
    expect(r).toHaveLength(0);
  });

  it("una categoría desconocida cae en 'otros'", () => {
    const r = subsToExpenses([sub({ categoria: "inventada" })], "2026-07", []);
    expect(r[0].categoria).toBe("otros");
  });

  it("dos suscripciones con el mismo nombre no se pisan entre sí", () => {
    // Caso real: "Tactic Pro" y "Tactic Pro 2" son distintas, pero si alguien
    // carga dos con el mismo nombre, solo debe crearse una.
    const r = subsToExpenses([sub({ nombre: "Tactic Pro" }), sub({ nombre: "Tactic Pro" })], "2026-07", []);
    expect(r).toHaveLength(1);
  });
});

describe("conceptoDeSuscripcion", () => {
  it("incluye el período para que sea único por mes", () => {
    expect(conceptoDeSuscripcion("  Canva ", "2026-07")).toBe("Canva — 2026-07");
  });
});
