import { describe, it, expect } from "vitest";
import { montosDeAbono } from "./invoices";

// Casos reales de agosto 2026, que fueron los que destaparon el bug: la factura
// salía al precio de lista y el recordatorio de cobro pedía otro número.
const magic = {
  id: "magic",
  fecha_inicio: "2026-07-04",
  contrato_fecha_inicio: "2026-07-04",
  contrato_descuento_pct: 0,
  contrato_descuento_monto: 25000,
  contrato_descuento_meses: 3,
};
const amelia = {
  id: "amelia",
  fecha_inicio: "2026-07-04",
  contrato_fecha_inicio: "2026-07-04",
  contrato_descuento_pct: 0,
  contrato_descuento_monto: 25000,
  contrato_descuento_meses: 1,
};

describe("montosDeAbono", () => {
  it("aplica el descuento del contrato mientras está vigente", () => {
    const m = montosDeAbono([{ id: "s1", cliente_id: "magic", monto_mensual: 350000 }], [magic], "2026-08");
    expect(m.get("s1")).toBe(325000);
  });

  it("deja de descontar cuando se cumplieron los meses pactados", () => {
    // Amelia: descuento por 1 mes desde julio → en agosto paga la tarifa entera.
    const jul = montosDeAbono([{ id: "s1", cliente_id: "amelia", monto_mensual: 350000 }], [amelia], "2026-07");
    const ago = montosDeAbono([{ id: "s1", cliente_id: "amelia", monto_mensual: 350000 }], [amelia], "2026-08");
    expect(jul.get("s1")).toBe(325000);
    expect(ago.get("s1")).toBe(350000);
  });

  it("no descuenta antes del mes de inicio del contrato", () => {
    const m = montosDeAbono([{ id: "s1", cliente_id: "magic", monto_mensual: 350000 }], [magic], "2026-06");
    expect(m.get("s1")).toBe(350000);
  });

  it("el monto fijo se resta UNA sola vez, en el servicio más caro", () => {
    const m = montosDeAbono(
      [
        { id: "chico", cliente_id: "magic", monto_mensual: 100000 },
        { id: "grande", cliente_id: "magic", monto_mensual: 350000 },
      ],
      [magic],
      "2026-08"
    );
    expect(m.get("grande")).toBe(325000);
    expect(m.get("chico")).toBe(100000);
    expect(m.get("grande")! + m.get("chico")!).toBe(450000 - 25000);
  });

  it("el porcentual se aplica a cada servicio (el total sale igual)", () => {
    const cliente = {
      id: "pct",
      contrato_fecha_inicio: "2026-08-01",
      contrato_descuento_pct: 10,
      contrato_descuento_monto: 0,
      contrato_descuento_meses: 6,
    };
    const m = montosDeAbono(
      [
        { id: "a", cliente_id: "pct", monto_mensual: 200000 },
        { id: "b", cliente_id: "pct", monto_mensual: 100000 },
      ],
      [cliente],
      "2026-08"
    );
    expect(m.get("a")).toBe(180000);
    expect(m.get("b")).toBe(90000);
  });

  it("sin descuento cargado factura el precio de lista", () => {
    const m = montosDeAbono(
      [{ id: "s1", cliente_id: "pelado", monto_mensual: 350000 }],
      [{ id: "pelado" }],
      "2026-08"
    );
    expect(m.get("s1")).toBe(350000);
  });

  it("un descuento sin meses cargados corre siempre (comportamiento viejo)", () => {
    const m = montosDeAbono(
      [{ id: "s1", cliente_id: "x", monto_mensual: 350000 }],
      [{ id: "x", contrato_fecha_inicio: "2020-01-01", contrato_descuento_monto: 50000, contrato_descuento_meses: 0 }],
      "2026-08"
    );
    expect(m.get("s1")).toBe(300000);
  });

  it("ignora servicios de clientes que no están en la lista (pausados o inactivos)", () => {
    const m = montosDeAbono([{ id: "s1", cliente_id: "fantasma", monto_mensual: 350000 }], [magic], "2026-08");
    expect(m.has("s1")).toBe(false);
  });
});
