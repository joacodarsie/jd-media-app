import { describe, it, expect } from "vitest";
import {
  ultimosPeriodos,
  armarSerie,
  compararMes,
  cascada,
  mesesDeAire,
  type MovimientoARS,
} from "./resumen";

const movs: MovimientoARS[] = [
  { periodo: "2026-09", montoARS: 350_000, tipo: "cobro" },
  { periodo: "2026-09", montoARS: 650_000, tipo: "cobro" },
  { periodo: "2026-09", montoARS: 400_000, tipo: "equipo" },
  { periodo: "2026-09", montoARS: 100_000, tipo: "gasto" },
  { periodo: "2026-08", montoARS: 800_000, tipo: "cobro" },
  { periodo: "2026-08", montoARS: 500_000, tipo: "equipo" },
  // Fuera de la ventana: no tiene que sumar en ningún lado.
  { periodo: "2025-01", montoARS: 9_999_999, tipo: "cobro" },
];

describe("ultimosPeriodos", () => {
  it("devuelve los meses del más viejo al más nuevo", () => {
    expect(ultimosPeriodos("2026-09", 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("cruza el cambio de año sin romperse", () => {
    expect(ultimosPeriodos("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("armarSerie", () => {
  const serie = armarSerie(ultimosPeriodos("2026-09", 3), movs);

  it("suma cada movimiento en su mes y su columna", () => {
    const sep = serie.find((m) => m.periodo === "2026-09")!;
    expect(sep.entro).toBe(1_000_000);
    expect(sep.equipo).toBe(400_000);
    expect(sep.gastos).toBe(100_000);
    expect(sep.salio).toBe(500_000);
    expect(sep.quedo).toBe(500_000);
    expect(sep.pctQuedo).toBe(50);
  });

  it("ignora lo que cae fuera de la ventana pedida", () => {
    expect(serie.reduce((a, m) => a + m.entro, 0)).toBe(1_800_000);
  });

  it("un mes sin movimientos queda en cero, no se saltea", () => {
    const jul = serie.find((m) => m.periodo === "2026-07")!;
    expect(jul.entro).toBe(0);
    expect(jul.quedo).toBe(0);
    expect(jul.pctQuedo).toBe(0);
  });
});

describe("compararMes", () => {
  const serie = armarSerie(ultimosPeriodos("2026-09", 3), movs);

  it("compara contra el mes anterior", () => {
    const c = compararMes(serie, "2026-09")!;
    expect(c.anterior?.periodo).toBe("2026-08");
    expect(c.delta).toBe(500_000 - 300_000);
  });

  it("los meses vacíos NO tiran el promedio para abajo", () => {
    const c = compararMes(serie, "2026-09")!;
    // Julio está vacío: promedian solo agosto y septiembre.
    expect(c.mesesConMovimiento).toBe(2);
    expect(c.promedio).toBe(400_000);
  });

  it("un período que no está en la serie devuelve null", () => {
    expect(compararMes(serie, "2020-01")).toBeNull();
  });
});

describe("cascada", () => {
  const serie = armarSerie(ultimosPeriodos("2026-09", 3), movs);

  it("va de lo que entró a lo que te queda, con los porcentajes", () => {
    // Entró 1.000.000 · equipo 400.000 · fijos 100.000
    const c = cascada(serie.find((m) => m.periodo === "2026-09")!);
    expect(c.entro).toBe(1_000_000);
    expect(c.margenAgencia).toBe(600_000);
    expect(Math.round(c.margenPct)).toBe(60);
    expect(c.fijos).toBe(100_000);
    expect(Math.round(c.fijosPct)).toBe(10);
    expect(c.tuSueldo).toBe(500_000);
    expect(Math.round(c.tuSueldoPct)).toBe(50);
  });

  it("el margen de la agencia NO descuenta los fijos: los paga después", () => {
    // Es la distinción que el dueño pidió ver: primero el margen que dejan las
    // cuentas, y recién después la estructura que se paga con ese margen.
    const c = cascada(serie.find((m) => m.periodo === "2026-09")!);
    expect(c.margenAgencia).toBe(c.tuSueldo + c.fijos);
  });

  it("un mes sin ingresos no divide por cero", () => {
    const vacio = armarSerie(["2026-09"], [
      { periodo: "2026-09", montoARS: 50_000, tipo: "equipo" as const },
    ]);
    const c = cascada(vacio[0]);
    expect(c.margenPct).toBe(0);
    expect(c.tuSueldo).toBe(-50_000);
  });
});

describe("mesesDeAire", () => {
  it("dice cuántos meses de estructura cubre lo acumulado", () => {
    expect(mesesDeAire(1_320_000, 660_000)).toBe(2);
  });

  it("acumulado negativo es cero meses de aire, no un número negativo", () => {
    expect(mesesDeAire(-500_000, 660_000)).toBe(0);
  });

  it("sin costo fijo cargado no inventa un número", () => {
    expect(mesesDeAire(1_000_000, 0)).toBeNull();
  });
});
