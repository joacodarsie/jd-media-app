import { describe, it, expect } from "vitest";
import {
  applyContractDiscount,
  reminderAmount,
  buildGroupedPaymentReminder,
  buildPaymentReminder,
  type ReminderClient,
} from "../payment-reminder";

describe("applyContractDiscount", () => {
  it("sin descuento devuelve el monto base", () => {
    expect(applyContractDiscount(100000, {})).toBe(100000);
  });

  it("aplica el porcentaje", () => {
    expect(applyContractDiscount(100000, { contrato_descuento_pct: 50 })).toBe(50000);
  });

  it("aplica el monto fijo", () => {
    expect(
      applyContractDiscount(100000, { contrato_descuento_monto: 30000 })
    ).toBe(70000);
  });

  it("el monto fijo tiene prioridad sobre el porcentaje", () => {
    expect(
      applyContractDiscount(100000, {
        contrato_descuento_pct: 50,
        contrato_descuento_monto: 30000,
      })
    ).toBe(70000);
  });

  it("nunca baja de cero", () => {
    expect(
      applyContractDiscount(20000, { contrato_descuento_monto: 50000 })
    ).toBe(0);
  });

  it("ignora porcentajes fuera de rango (>=100)", () => {
    expect(applyContractDiscount(100000, { contrato_descuento_pct: 100 })).toBe(100000);
  });
});

describe("reminderAmount", () => {
  it("usa el descuento por monto fijo", () => {
    const c: ReminderClient = {
      nombre: "Marca",
      monto_mensual: 200000,
      contrato_descuento_monto: 50000,
    };
    expect(reminderAmount(c)).toEqual({ monto: 150000, moneda: "ARS" });
  });
});

describe("buildGroupedPaymentReminder", () => {
  const a: ReminderClient = {
    nombre: "Marca A",
    contacto_nombre: "Juan Pérez",
    monto_mensual: 100000,
    contrato_moneda: "ARS",
  };
  const b: ReminderClient = {
    nombre: "Marca B",
    contacto_nombre: "Juan Pérez",
    monto_mensual: 60000,
    contrato_moneda: "ARS",
  };

  it("con una sola cuenta delega al mensaje individual", () => {
    expect(buildGroupedPaymentReminder([a], "2026-07")).toBe(
      buildPaymentReminder(a, "2026-07")
    );
  });

  it("lista cada marca y suma el total", () => {
    const msg = buildGroupedPaymentReminder([a, b], "2026-07");
    expect(msg).toContain("Marca A");
    expect(msg).toContain("Marca B");
    expect(msg).toContain("Total:");
    // Saluda una sola vez, al titular.
    expect(msg).toContain("Juan");
    expect((msg.match(/Marca A/g) ?? []).length).toBe(1);
  });

  it("respeta el descuento de cada marca en el total", () => {
    const conDesc: ReminderClient = { ...b, contrato_descuento_monto: 10000 };
    const msg = buildGroupedPaymentReminder([a, conDesc], "2026-07");
    // 100.000 + (60.000 - 10.000) = 150.000
    expect(msg).toMatch(/150\.000/);
  });
});
