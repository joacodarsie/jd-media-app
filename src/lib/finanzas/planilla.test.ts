import { describe, it, expect } from "vitest";
import {
  clientesPlanilla,
  deudasPlanilla,
  facturadoPorPeriodo,
  facturadoUltimos12,
  mesesPlanilla,
  periodoAnterior,
  sueldosPlanilla,
} from "./planilla";
import type { FilaCliente } from "./informe-mensual";
import type { FilaCobro } from "./informe-xlsx";

const fila = (over: Partial<FilaCliente>): FilaCliente => ({
  cliente: "X",
  servicio: "Gestión de redes",
  pack: "Presencia",
  abono: 400000,
  costoEntrega: 160000,
  coordinacion: 40000,
  margen: 200000,
  margenPct: 0.5,
  desde: "2026-08-01",
  meses: 3,
  ...over,
});

describe("facturado", () => {
  const f = facturadoPorPeriodo([
    { periodo: "2026-09", montoARS: 300000 },
    { periodo: "2026-09", montoARS: 600000 },
    { periodo: "2026-10", montoARS: 1000000 },
    { periodo: "2025-10", montoARS: 50000 },
    { periodo: "2025-11", montoARS: 70000 },
  ]);

  it("suma por período", () => {
    expect(f.get("2026-09")).toBe(900000);
  });

  it("los 12 meses incluyen el actual y dejan afuera el mismo mes del año anterior", () => {
    expect(facturadoUltimos12(f, "2026-10")).toBe(70000 + 900000 + 1000000);
  });

  it("en diciembre toma enero a diciembre del mismo año", () => {
    const g = facturadoPorPeriodo([
      { periodo: "2026-01", montoARS: 1 },
      { periodo: "2025-12", montoARS: 10 },
      { periodo: "2026-12", montoARS: 100 },
    ]);
    expect(facturadoUltimos12(g, "2026-12")).toBe(101);
  });
});

describe("mesesPlanilla", () => {
  it("el resultado sale de lo facturado, no de lo cobrado", () => {
    // El Dr Dionisi paga dos meses juntos: lo cobrado salta, lo facturado no.
    const [m] = mesesPlanilla(
      [{ periodo: "2026-10", entro: 1200000, equipo: 500000, gastos: 100000, salio: 600000, quedo: 600000, pctQuedo: 0.5 }],
      new Map([["2026-10", 900000]]),
    );
    expect(m).toEqual({
      periodo: "2026-10",
      facturado: 900000,
      cobrado: 1200000,
      equipo: 500000,
      gastos: 100000,
      resultado: 300000,
      margen: 0.333,
      equipoEstimado: false,
    });
  });

  it("el mes que todavía no se le pagó al equipo usa la nómina calculada", () => {
    const serie = [
      { periodo: "2026-09", entro: 0, equipo: 2700000, gastos: 0, salio: 0, quedo: 0, pctQuedo: 0 },
      { periodo: "2026-10", entro: 0, equipo: 0, gastos: 350000, salio: 0, quedo: 0, pctQuedo: 0 },
    ];
    const nomina = new Map([["2026-09", 9], ["2026-10", 4136079]]);
    const [sep, oct] = mesesPlanilla(serie, new Map([["2026-10", 7106129]]), nomina);
    // Septiembre ya está pagado: manda lo pagado, no lo calculado.
    expect(sep).toMatchObject({ equipo: 2700000, equipoEstimado: false });
    expect(oct).toMatchObject({ equipo: 4136079, equipoEstimado: true, resultado: 7106129 - 4136079 - 350000 });
  });

  it("período anterior", () => {
    expect(periodoAnterior("2026-11")).toBe("2026-10");
    expect(periodoAnterior("2027-01")).toBe("2026-12");
  });

  it("un mes sin facturación tiene margen 0, no NaN", () => {
    const [m] = mesesPlanilla(
      [{ periodo: "2026-11", entro: 0, equipo: 0, gastos: 0, salio: 0, quedo: 0, pctQuedo: 0 }],
      new Map(),
    );
    expect(m.margen).toBe(0);
  });
});

describe("clientesPlanilla", () => {
  it("junta los servicios de un cliente y suma la coordinación al costo", () => {
    const c = clientesPlanilla([
      fila({ cliente: "CATCH", pack: "Crecimiento", abono: 600000, costoEntrega: 300000, coordinacion: 60000 }),
      fila({ cliente: "CATCH", pack: "Pauta", abono: 100000, costoEntrega: 50000, coordinacion: 0 }),
    ]);
    expect(c).toEqual([
      { cliente: "CATCH", pack: "Crecimiento + Pauta", abono: 700000, costo: 410000, margen: 290000, margenPct: 0.414, desde: "2026-08-01" },
    ]);
  });

  it("ordena del peor margen al mejor", () => {
    const c = clientesPlanilla([
      fila({ cliente: "Bueno", abono: 400000, costoEntrega: 100000, coordinacion: 0 }),
      fila({ cliente: "Malo", abono: 300000, costoEntrega: 290000, coordinacion: 5000 }),
    ]);
    expect(c.map((x) => x.cliente)).toEqual(["Malo", "Bueno"]);
  });
});

describe("deudasPlanilla", () => {
  const cobro = (over: Partial<FilaCobro>): FilaCobro => ({
    cliente: "Nazar Hogar",
    periodo: "2026-10",
    concepto: "Abono",
    monto: 500000,
    moneda: "ARS",
    cobrado: false,
    fechaCobro: null,
    aCuenta: 25000,
    saldo: 475000,
    ...over,
  });

  it("solo lo no cobrado con saldo, de lo más viejo a lo más nuevo", () => {
    const d = deudasPlanilla([
      cobro({}),
      cobro({ cliente: "Power Collection", periodo: "2026-07", saldo: 175000 }),
      cobro({ cliente: "CATCH", cobrado: true, saldo: 0 }),
    ]);
    expect(d).toEqual([
      { cliente: "Power Collection", periodo: "2026-07", saldo: 175000 },
      { cliente: "Nazar Hogar", periodo: "2026-10", saldo: 475000 },
    ]);
  });
});

describe("sueldosPlanilla", () => {
  it("de mayor a menor, sin los que no cobran nada", () => {
    const s = sueldosPlanilla([
      { nombre: "Matías", alias: "mati.mp", titular: "Matías Moyano", total: 50000, pagado: false },
      { nombre: "Luz", alias: null, titular: null, total: 832633.4, pagado: true, montoPagado: 832633 },
      { nombre: "Nadie", alias: null, titular: null, total: 0, pagado: false },
    ]);
    expect(s.map((x) => x.nombre)).toEqual(["Luz", "Matías"]);
    expect(s[0]).toEqual({ nombre: "Luz", alias: null, titular: null, total: 832633, pagado: true, montoPagado: 832633 });
  });
});
