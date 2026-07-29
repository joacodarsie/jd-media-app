/**
 * Tests de "La plata del mes". Lo que importa que no mienta: los totales
 * (pendiente vs ya hecho) y que el mensaje de pago lleve el detalle de a qué
 * corresponde cada peso — que es justamente lo que evita el ida y vuelta.
 */
import { describe, it, expect } from "vitest";
import { buildTeamPaymentMessage, buildInvoiceReminder, resumirMes } from "../finanzas/mes";

describe("resumirMes", () => {
  const input = {
    facturas: [
      { monto: 350000, cobrada: true },
      { monto: 350000, cobrada: false },
      { monto: 200000, cobrada: false },
    ],
    pagos: [
      { monto: 100000, pagado: true },
      { monto: 50000, pagado: false },
    ],
  };

  it("separa lo total de lo que ya pasó", () => {
    const r = resumirMes(input);
    expect(r.aCobrar).toBe(900000);
    expect(r.cobrado).toBe(350000);
    expect(r.pendienteCobrar).toBe(550000);
    expect(r.aPagar).toBe(150000);
    expect(r.pagado).toBe(100000);
    expect(r.pendientePagar).toBe(50000);
  });

  it("el resultado proyectado y el real son distintos", () => {
    const r = resumirMes(input);
    expect(r.resultado).toBe(750000); // si entra todo y se paga todo
    expect(r.resultadoReal).toBe(250000); // lo que pasó de verdad
  });

  it("sin datos no rompe ni divide por cero", () => {
    const r = resumirMes({ facturas: [], pagos: [] });
    expect(r.aCobrar).toBe(0);
    expect(r.resultado).toBe(0);
  });
});

describe("buildTeamPaymentMessage", () => {
  const base = {
    nombre: "Sol Britos",
    periodo: "2026-07",
    total: 175000,
    lineas: [
      { concepto: "Community Manager", cliente: "Boxescar", monto: 50000 },
      { concepto: "Community Manager", cliente: "La Azotea", monto: 50000 },
      { concepto: "Comisión cierre (10%) · primer mes", cliente: "Magic", monto: 75000 },
    ],
  };

  it("saluda por el nombre de pila y lista el detalle con la cuenta", () => {
    const m = buildTeamPaymentMessage(base);
    expect(m.startsWith("¡Hola Sol!")).toBe(true);
    expect(m).toContain("Boxescar · Community Manager");
    expect(m).toContain("Magic · Comisión cierre");
  });

  it("muestra el total", () => {
    expect(buildTeamPaymentMessage(base)).toContain("175.000");
  });

  it("suma el alias solo si lo hay", () => {
    expect(buildTeamPaymentMessage({ ...base, alias: "sol.jd" })).toContain("sol.jd");
    expect(buildTeamPaymentMessage(base)).not.toContain("Transferencia a");
  });

  it("las líneas en cero no ensucian el detalle", () => {
    const m = buildTeamPaymentMessage({
      ...base,
      lineas: [...base.lineas, { concepto: "Ajuste", cliente: null, monto: 0 }],
    });
    expect(m).not.toContain("Ajuste");
  });

  it("una línea sin cuenta no arrastra el separador", () => {
    const m = buildTeamPaymentMessage({
      ...base,
      lineas: [{ concepto: "Gestión de mensajes (fijo mensual)", cliente: "—", monto: 50000 }],
    });
    expect(m).toContain("• Gestión de mensajes");
    expect(m).not.toContain("— ·");
  });
});

describe("buildInvoiceReminder", () => {
  const base = {
    clienteNombre: "Boxescar",
    contactoNombre: "Américo Pereira",
    periodo: "2026-07",
    monto: 200000,
  };

  it("usa el monto de la factura y saluda al contacto", () => {
    const m = buildInvoiceReminder(base);
    expect(m.startsWith("¡Hola Américo!")).toBe(true);
    expect(m).toContain("200.000");
  });

  it("si no hay contacto usa el nombre de la cuenta", () => {
    const m = buildInvoiceReminder({ ...base, contactoNombre: null });
    expect(m.startsWith("¡Hola Boxescar!")).toBe(true);
  });

  it("con varias facturas del mes las lista", () => {
    const m = buildInvoiceReminder({
      ...base,
      conceptos: ["Gestión de redes — 2026-07", "Paid Media — 2026-07"],
    });
    expect(m).toContain("• Paid Media — 2026-07");
  });

  it("con una sola factura no lista conceptos", () => {
    const m = buildInvoiceReminder({ ...base, conceptos: ["Gestión de redes — 2026-07"] });
    expect(m).not.toContain("• Gestión de redes");
  });
});
