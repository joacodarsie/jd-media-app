import { describe, it, expect } from "vitest";
import {
  applyContractDiscount,
  reminderAmount,
  buildGroupedPaymentReminder,
  buildPaymentReminder,
  normalizePhone,
  whatsappLink,
  type ReminderClient,
} from "../payment-reminder";

describe("normalizePhone — mismo criterio que prospección", () => {
  it("arregla el celular argentino publicado sin el 9", () => {
    expect(normalizePhone("+54 351 331 9555")).toBe("5493513319555");
  });

  it("saca el 15 local", () => {
    expect(normalizePhone("+54 351 15 331 9555")).toBe("5493513319555");
  });

  it("un número ya correcto no se toca", () => {
    expect(normalizePhone("5493513319555")).toBe("5493513319555");
  });

  it("sin teléfono o basura devuelve null", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });

  it("el link de WhatsApp sale con los dígitos ya normalizados", () => {
    expect(whatsappLink("+54 351 15 331 9555", "hola")).toBe(
      "https://wa.me/5493513319555?text=hola"
    );
  });
});

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

describe("descuento con vencimiento (contrato_descuento_meses)", () => {
  const magic = {
    contrato_descuento_monto: 25000,
    contrato_descuento_meses: 3,
    contrato_fecha_inicio: "2026-07-05",
  };

  it("aplica durante los meses pactados, contando el de inicio", () => {
    expect(applyContractDiscount(325000, magic, "2026-07")).toBe(300000);
    expect(applyContractDiscount(325000, magic, "2026-08")).toBe(300000);
    expect(applyContractDiscount(325000, magic, "2026-09")).toBe(300000);
  });

  it("DEJA de aplicar cuando se cumplieron", () => {
    expect(applyContractDiscount(325000, magic, "2026-10")).toBe(325000);
    expect(applyContractDiscount(325000, magic, "2027-01")).toBe(325000);
  });

  it("un descuento de 1 mes no se arrastra al siguiente", () => {
    const unMes = {
      contrato_descuento_monto: 25000,
      contrato_descuento_meses: 1,
      contrato_fecha_inicio: "2026-07-05",
    };
    expect(applyContractDiscount(350000, unMes, "2026-07")).toBe(325000);
    expect(applyContractDiscount(350000, unMes, "2026-08")).toBe(350000);
  });

  it("sin meses cargados sigue siendo permanente", () => {
    const permanente = { contrato_descuento_monto: 25000, contrato_fecha_inicio: "2020-01-01" };
    expect(applyContractDiscount(100000, permanente, "2026-12")).toBe(75000);
  });

  it("sin período o sin fecha de inicio no rompe: aplica", () => {
    expect(applyContractDiscount(325000, magic)).toBe(300000);
    expect(
      applyContractDiscount(325000, { ...magic, contrato_fecha_inicio: null }, "2027-05")
    ).toBe(300000);
  });

  it("un período anterior al inicio no descuenta", () => {
    expect(applyContractDiscount(325000, magic, "2026-06")).toBe(325000);
  });

  it("el mensaje del recordatorio refleja el vencimiento", () => {
    const c = { nombre: "Magic", monto_mensual: 325000, ...magic };
    expect(buildPaymentReminder(c, "2026-07")).toContain("300.000");
    expect(buildPaymentReminder(c, "2026-10")).toContain("325.000");
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
