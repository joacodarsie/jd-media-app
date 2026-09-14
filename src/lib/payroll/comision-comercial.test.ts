import { describe, it, expect } from "vitest";
import {
  mesDelCliente,
  selectCloserCommissions,
  selectUpsellCommissions,
  selectCloserPrizes,
  type ServicioComision,
} from "./comision-comercial";
import { DEFAULT_AGENCY_SETTINGS } from "../coordinacion";
import type { PayrollClient } from "../payroll";

// Los números del acuerdo firmado con Santi el 14/9/2026.
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
  it("el mes 1 paga el 10% del abono: cliente de $300.000 → $30.000", () => {
    const out = selectCloserCommissions([cliente()], rec, "2026-09", rates, noManual);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ closerId: "santi", clienteId: "c1", base: 300_000, pct: 0.1, monto: 30_000 });
    expect(out[0].concepto).toContain("mes 1");
  });

  it("del mes 2 al 6 paga el 5% cada mes: $15.000", () => {
    for (const periodo of ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]) {
      const out = selectCloserCommissions([cliente()], rec, periodo, rates, noManual);
      expect(out).toHaveLength(1);
      expect(out[0].monto).toBe(15_000);
    }
    const mes6 = selectCloserCommissions([cliente()], rec, "2027-02", rates, noManual);
    expect(mes6[0].concepto).toContain("mes 6 de 6");
  });

  it("en el mes 7 se termina", () => {
    expect(selectCloserCommissions([cliente()], rec, "2027-03", rates, noManual)).toHaveLength(0);
  });

  it("el total por un cliente que se queda es el 35% de un abono, repartido en 6 meses", () => {
    let total = 0;
    for (const periodo of ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]) {
      total += selectCloserCommissions([cliente()], rec, periodo, rates, noManual).reduce((a, l) => a + l.monto, 0);
    }
    expect(total).toBe(30_000 + 15_000 * 5); // $105.000 = 35% de $300.000
  });

  it("si el cliente se fue no está en la lista y el residual se corta solo", () => {
    // La nómina solo pasa cuentas ACTIVAS del período: una que se dio de baja
    // no aparece, así que no hay nada que pagar.
    expect(selectCloserCommissions([], rec, "2026-11", rates, noManual)).toHaveLength(0);
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

  it("los meses del residual salen de la config: con 0 meses solo paga el mes 1", () => {
    const soloMes1 = { ...rates, comision_residual_meses: 0 };
    expect(selectCloserCommissions([cliente()], rec, "2026-09", soloMes1, noManual)).toHaveLength(1);
    expect(selectCloserCommissions([cliente()], rec, "2026-10", soloMes1, noManual)).toHaveLength(0);
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
      ["santi", 30_000],
      ["joaco", 40_000],
    ]);
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

describe("selectCloserPrizes — premio del mes", () => {
  const cuentas = (n: number, abono = 300_000) =>
    Array.from({ length: n }, (_, i) => ({
      c: cliente({ id: `c${i}`, nombre: `Cuenta ${i}` }),
      s: servicio({ cliente_id: `c${i}`, monto_mensual: abono }),
    }));

  it("con 3 cuentas nuevas de $300.000 paga $50.000", () => {
    const x = cuentas(3);
    const out = selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-09", rates);
    expect(out).toEqual([{ closerId: "santi", cuentas: 3, monto: 50_000, concepto: "Premio del mes · 3 cuentas nuevas" }]);
  });

  it("con 5 paga $150.000, no $200.000: se cobra el más alto", () => {
    const x = cuentas(5);
    expect(selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-09", rates)[0].monto).toBe(150_000);
  });

  it("con 2 no hay premio", () => {
    const x = cuentas(2);
    expect(selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-09", rates)).toHaveLength(0);
  });

  it("las cuentas por debajo de $300.000 no cuentan", () => {
    const x = [...cuentas(2), ...cuentas(1, 250_000).map((v) => ({ c: { ...v.c, id: "chica" }, s: { ...v.s, cliente_id: "chica" } }))];
    expect(selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-09", rates)).toHaveLength(0);
  });

  it("solo gestión de redes: tres cuentas de solo pauta no suman", () => {
    const x = cuentas(3).map((v) => ({ c: v.c, s: { ...v.s, tipo: "paid_media" } }));
    expect(selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-09", rates)).toHaveLength(0);
  });

  it("arranca de cero cada mes: las del mes pasado no cuentan", () => {
    const x = cuentas(3);
    expect(selectCloserPrizes(x.map((v) => v.c), x.map((v) => v.s), "2026-10", rates)).toHaveLength(0);
  });
});
