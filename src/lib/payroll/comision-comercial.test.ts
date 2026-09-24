import { describe, it, expect } from "vitest";
import {
  mesDelCliente,
  selectCarteraCommissions,
  selectCloserCommissions,
  selectUpsellCommissions,
  selectDireccionCreativaCuentas,
  pctCierre,
  type ServicioComision,
} from "./comision-comercial";
import { DEFAULT_AGENCY_SETTINGS } from "../coordinacion";
import type { PayrollClient } from "../payroll";

// Los números de los acuerdos de Santi y Mati (16/9/2026).
const rates = DEFAULT_AGENCY_SETTINGS.rates;

function cliente(over: Partial<PayrollClient> = {}): PayrollClient {
  return {
    id: "c1",
    nombre: "Cliente",
    cm_id: null,
    disenador_id: null,
    audiovisual_id: null,
    media_buyer_id: null,
    coordinador_id: null,
    cerrado_por_id: "santi",
    fecha_inicio: "2026-09-10",
    ...over,
  };
}
function servicio(over: Partial<ServicioComision> = {}): ServicioComision {
  return {
    cliente_id: "c1",
    tipo: "gestion_redes",
    monto_mensual: 300_000,
    facturacion: "mensual",
    fecha_inicio: null,
    created_at: "2026-09-10T00:00:00Z",
    vendido_por_id: null,
    ...over,
  };
}
const rec = new Map<string, number>([["c1", 300_000]]);
// Lo que es gestión de redes de ese abono (el resto, otro servicio).
const gdr = new Map<string, number>([["c1", 250_000]]);
const noManual = () => false;

describe("mesDelCliente", () => {
  it("el mes de arranque es el 1", () => {
    expect(mesDelCliente("2026-09-10", "2026-09")).toBe(1);
  });
  it("cuenta meses de calendario, no días", () => {
    expect(mesDelCliente("2026-09-30", "2026-10")).toBe(2);
    expect(mesDelCliente("2026-09-01", "2027-02")).toBe(6);
    expect(mesDelCliente("2025-12-15", "2026-01")).toBe(2);
  });
  it("antes de arrancar o sin fecha no hay mes", () => {
    expect(mesDelCliente("2026-10-01", "2026-09")).toBeNull();
    expect(mesDelCliente(null, "2026-09")).toBeNull();
    expect(mesDelCliente("", "2026-09")).toBeNull();
  });
});

describe("selectCloserCommissions — cliente nuevo", () => {
  it("el mes 1 paga el 15% del abono: cliente de $300.000 → $45.000", () => {
    const out = selectCloserCommissions([cliente()], rec, "2026-09", rates, noManual);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ closerId: "santi", clienteId: "c1", base: 300_000, pct: 0.15, monto: 45_000 });
    expect(out[0].concepto).toContain("mes 1");
  });

  it("del mes 2 en adelante no paga venta: eso pasa a ser cartera", () => {
    for (const periodo of ["2026-10", "2026-12", "2027-06"]) {
      expect(selectCloserCommissions([cliente()], rec, periodo, rates, noManual)).toHaveLength(0);
    }
  });

  it("sin 'cerrado por' no hay comisión (la venta no es de nadie)", () => {
    expect(
      selectCloserCommissions([cliente({ cerrado_por_id: null })], rec, "2026-09", rates, noManual)
    ).toHaveLength(0);
  });

  it("no duplica si ya se cargó una comisión a mano para esa cuenta ese mes", () => {
    expect(
      selectCloserCommissions([cliente()], rec, "2026-09", rates, (id) => id === "c1")
    ).toHaveLength(0);
  });

  it("sin abono recurrente no hay base", () => {
    expect(selectCloserCommissions([cliente()], new Map(), "2026-09", rates, noManual)).toHaveLength(0);
  });

  it("dos closers distintos cobran cada uno lo suyo", () => {
    const out = selectCloserCommissions(
      [cliente(), cliente({ id: "c2", nombre: "Otro", cerrado_por_id: "joaco" })],
      new Map([
        ["c1", 300_000],
        ["c2", 400_000],
      ]),
      "2026-09",
      rates,
      noManual
    );
    expect(out.map((l) => [l.closerId, l.monto])).toEqual([
      ["santi", 45_000],
      ["joaco", 60_000],
    ]);
  });
});

describe("cartera comercial (desde octubre): el 5% es de quien cerró", () => {
  const pago = () => true;

  it("el mes 1 no paga cartera: ese mes se cobra la venta", () => {
    const c = cliente({ fecha_inicio: "2026-10-05" });
    expect(selectCarteraCommissions([c], rec, "2026-10", rates, pago)).toHaveLength(0);
  });

  it("desde el mes 2 paga el 5% del abono todos los meses a quien cerró", () => {
    const c = cliente({ cerrado_por_id: "santi", responsable_id: "otro" });
    for (const periodo of ["2026-10", "2026-12", "2027-06"]) {
      const out = selectCarteraCommissions([c], rec, periodo, rates, pago);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ closerId: "santi", monto: 15_000, pct: 0.05 });
      expect(out[0].concepto).toContain("Cartera comercial");
    }
  });

  it("si el cliente no pagó ese mes, no se cobra", () => {
    expect(selectCarteraCommissions([cliente()], rec, "2026-10", rates, () => false)).toHaveLength(0);
  });

  it("si nadie la cerró (la cerró el director), no hay cartera comercial", () => {
    const c = cliente({ cerrado_por_id: null, responsable_id: "santi" });
    expect(selectCarteraCommissions([c], rec, "2026-10", rates, pago)).toHaveLength(0);
  });

  it("un cliente que se fue no viene en la lista y la cartera se corta sola", () => {
    expect(selectCarteraCommissions([], rec, "2026-10", rates, pago)).toHaveLength(0);
  });
});

describe("hasta septiembre se liquida con el acuerdo viejo", () => {
  const pago = () => true;
  it("la cartera era de quien atendía la cuenta y el mes 1 pagaba 15%", () => {
    const c = cliente({ cerrado_por_id: "mati", responsable_id: "santi", fecha_inicio: "2026-07-01" });
    const out = selectCarteraCommissions([c], rec, "2026-09", rates, pago);
    expect(out[0]).toMatchObject({ closerId: "santi", monto: 15_000 });
    const nueva = cliente({ fecha_inicio: "2026-09-10" });
    expect(selectCloserCommissions([nueva], rec, "2026-09", rates, noManual)[0].monto).toBe(45_000);
    expect(pctCierre("2026-09", rates)).toBe(0.15);
  });
  it("la dirección creativa por cuenta no existe antes de octubre", () => {
    const c = cliente({ responsable_id: "santi", fecha_inicio: "2026-07-01" });
    expect(selectDireccionCreativaCuentas([c], gdr, "2026-09", rates, pago)).toHaveLength(0);
  });
});

describe("dirección creativa por cuenta (desde octubre)", () => {
  const pago = () => true;

  it("5% del abono de gestión de redes, desde el mes 1, al director creativo", () => {
    const c = cliente({ responsable_id: "santi", fecha_inicio: "2026-10-03" });
    const out = selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, pago);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ closerId: "santi", base: 250_000, monto: 12_500, pct: 0.05 });
    expect(out[0].concepto).toBe("Dirección creativa (5%)");
  });

  it("solo sobre gestión de redes: una cuenta sin redes no paga", () => {
    const c = cliente({ id: "c2", responsable_id: "santi" });
    expect(selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, pago)).toHaveLength(0);
  });

  it("si el cliente no pagó ese mes, no se cobra", () => {
    const c = cliente({ responsable_id: "santi" });
    expect(selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, () => false)).toHaveLength(0);
  });

  it("con historial manda el historial, no la ficha", () => {
    const c = cliente({ responsable_id: "santi" });
    const out = selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, pago, () => [
      { userId: "luz", fraccion: 1 },
    ]);
    expect(out[0].closerId).toBe("luz");
  });

  it("si ese mes no la llevaba nadie, no se paga aunque la ficha diga otra cosa", () => {
    const c = cliente({ responsable_id: "santi" });
    expect(selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, pago, () => [])).toHaveLength(0);
  });

  it("un pase a mitad de mes se reparte por días", () => {
    const c = cliente({ responsable_id: "santi" });
    const out = selectDireccionCreativaCuentas([c], gdr, "2026-10", rates, pago, () => [
      { userId: "luz", fraccion: 0.6 },
      { userId: "santi", fraccion: 0.4 },
    ]);
    expect(out.map((l) => [l.closerId, l.monto])).toEqual([
      ["luz", 7_500],
      ["santi", 5_000],
    ]);
    expect(out[0].concepto).toContain("60% del mes");
  });

  it("lo acordado con Santi: si cierra él, 10% + 5% + 5% (cartera y dirección)", () => {
    // Cuenta de $300.000 con $250.000 de gestión de redes, que cerró y dirige Santi.
    const c = cliente({ cerrado_por_id: "santi", responsable_id: "santi", fecha_inicio: "2026-10-01" });
    const mes = (periodo: string) =>
      [
        ...selectCloserCommissions([c], rec, periodo, rates, noManual),
        ...selectCarteraCommissions([c], rec, periodo, rates, pago),
        ...selectDireccionCreativaCuentas([c], gdr, periodo, rates, pago),
      ].reduce((a, l) => a + l.monto, 0);
    expect(mes("2026-10")).toBe(30_000 + 12_500); // 10% venta + dirección
    expect(mes("2026-11")).toBe(15_000 + 12_500); // 5% cartera + dirección
  });
});

describe("selectUpsellCommissions — servicio extra", () => {
  const viejo = cliente({ fecha_inicio: "2026-06-01" });

  it("un servicio nuevo en una cuenta activa paga el 15% una sola vez a quien lo vendió", () => {
    const pauta = servicio({ tipo: "paid_media", monto_mensual: 150_000, vendido_por_id: "santi" });
    const out = selectUpsellCommissions([viejo], [pauta], "2026-09", rates);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ closerId: "santi", base: 150_000, pct: 0.15, monto: 22_500 });
    // Al mes siguiente ya no.
    expect(selectUpsellCommissions([viejo], [pauta], "2026-10", rates)).toHaveLength(0);
  });

  it("un cobro único también paga: sobre lo que paga ese servicio", () => {
    const edicion = servicio({ tipo: "edicion_audiovisual", monto_mensual: 60_000, facturacion: "unico", vendido_por_id: "santi" });
    expect(selectUpsellCommissions([viejo], [edicion], "2026-09", rates)[0].monto).toBe(9_000);
  });

  it("los servicios que nacen con la cuenta NO son extra: esa venta la paga el mes 1", () => {
    const nuevo = cliente({ fecha_inicio: "2026-09-10" });
    const redes = servicio({ vendido_por_id: "santi" });
    expect(selectUpsellCommissions([nuevo], [redes], "2026-09", rates)).toHaveLength(0);
  });

  it("sin 'vendido por' no hay comisión, aunque la cuenta tenga closer", () => {
    expect(selectUpsellCommissions([viejo], [servicio({ tipo: "paid_media" })], "2026-09", rates)).toHaveLength(0);
  });

  it("usa la fecha de inicio del servicio si está, y si no la de creación", () => {
    const s = servicio({ tipo: "paid_media", vendido_por_id: "santi", fecha_inicio: "2026-10-01", created_at: "2026-09-20T00:00:00Z" });
    expect(selectUpsellCommissions([viejo], [s], "2026-09", rates)).toHaveLength(0);
    expect(selectUpsellCommissions([viejo], [s], "2026-10", rates)).toHaveLength(1);
  });

  it("una cuenta sin fecha de inicio no paga extra: no se puede saber si es extra", () => {
    const sinFecha = cliente({ fecha_inicio: null });
    expect(selectUpsellCommissions([sinFecha], [servicio({ tipo: "paid_media", vendido_por_id: "santi" })], "2026-09", rates)).toHaveLength(0);
  });
});
