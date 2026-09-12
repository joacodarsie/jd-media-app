import { describe, it, expect, beforeAll } from "vitest";
import { INFORME_GS } from "./informe-gs";

/**
 * Corre el script de Google Sheets de verdad, contra una planilla simulada.
 *
 * Por qué existe: Apps Script no tiene compilador ni tests. Cada error se
 * descubría cuando el dueño apretaba el botón y nos mandaba la captura — pasó
 * tres veces seguidas (inmovilizar columnas, `FUENTE is not defined`, y
 * "Those columns are out of bounds" al sumar una columna al Resumen).
 *
 * El simulador de abajo respeta los límites reales de una hoja: pedir una
 * columna que no existe explota igual que en Google. Eso es justo lo que
 * agarraba tarde.
 */

interface HojaSim {
  nombre: string;
  maxRows: number;
  maxColumns: number;
}

/** Una planilla de mentira que se queja igual que la de verdad. */
function planillaSimulada(hojasIniciales: Record<string, { cols: number; rows: number }> = {}) {
  const hojas = new Map<string, HojaSim>();
  const errores: string[] = [];

  function crearHoja(nombre: string, cols: number, rows: number): HojaSim {
    const h: HojaSim = { nombre, maxRows: rows, maxColumns: cols };
    hojas.set(nombre, h);
    return h;
  }
  for (const [n, v] of Object.entries(hojasIniciales)) crearHoja(n, v.cols, v.rows);

  const celda: Record<string, unknown> = {};
  const rango = new Proxy(celda, {
    get: (_t, k) => {
      if (k === "getValue" || k === "getBackground") return () => "";
      if (k === "getValues") return () => [[]];
      return () => rango;
    },
  });

  function envolver(h: HojaSim) {
    const api: Record<string, unknown> = {
      getName: () => h.nombre,
      getMaxRows: () => h.maxRows,
      getMaxColumns: () => h.maxColumns,
      getFilter: () => null,
      getBandings: () => [],
      getFrozenRows: () => 0,
      getFrozenColumns: () => 0,
      getRange: (fila: number, col: number, nf?: number, nc?: number) => {
        const ultimaFila = fila + (nf ?? 1) - 1;
        const ultimaCol = col + (nc ?? 1) - 1;
        if (col < 1 || ultimaCol > h.maxColumns) {
          errores.push(
            `${h.nombre}: getRange pidió hasta la columna ${ultimaCol} y la hoja tiene ${h.maxColumns}`
          );
        }
        if (fila < 1 || ultimaFila > h.maxRows) {
          errores.push(
            `${h.nombre}: getRange pidió hasta la fila ${ultimaFila} y la hoja tiene ${h.maxRows}`
          );
        }
        return rango;
      },
      setColumnWidth: (col: number) => {
        if (col > h.maxColumns) {
          errores.push(
            `${h.nombre}: setColumnWidth en la columna ${col} y la hoja tiene ${h.maxColumns}`
          );
        }
        return api;
      },
      setRowHeight: (fila: number) => {
        if (fila > h.maxRows) {
          errores.push(`${h.nombre}: setRowHeight en la fila ${fila} y la hoja tiene ${h.maxRows}`);
        }
        return api;
      },
      insertColumnsAfter: (_desde: number, cuantas: number) => {
        h.maxColumns += cuantas;
        return api;
      },
      deleteColumns: (desde: number, cuantas: number) => {
        if (desde + cuantas - 1 > h.maxColumns) {
          errores.push(`${h.nombre}: deleteColumns fuera de rango`);
        }
        h.maxColumns -= cuantas;
        return api;
      },
      getColumn: () => rango,
      getRow: () => rango,
    };
    return new Proxy(api, {
      get: (t, k) => (k in t ? t[k as string] : () => api),
    });
  }

  const ss: Record<string, unknown> = {
    getSheetByName: (n: string) => (hojas.has(n) ? envolver(hojas.get(n)!) : null),
    insertSheet: (n: string) => envolver(crearHoja(n, 26, 1000)),
    getSheets: () => [...hojas.values()].map(envolver),
    deleteSheet: (h: { getName: () => string }) => hojas.delete(h.getName()),
  };
  const planilla = new Proxy(ss, { get: (t, k) => (k in t ? t[k as string] : () => planilla) });

  return { planilla, errores, hojas };
}

/** Los stubs de la API global de Apps Script. */
function instalarGlobales() {
  const encadenable = (): unknown =>
    new Proxy({}, { get: (_t, k) => (k === "build" ? () => ({}) : () => encadenable()) });
  (globalThis as Record<string, unknown>).SpreadsheetApp = {
    BandingTheme: { LIGHT_GREY: 1 },
    BorderStyle: { SOLID: 1, DOUBLE: 2 },
    newConditionalFormatRule: encadenable,
    newTextStyle: encadenable,
    newRichTextValue: encadenable,
  };
}

/** Datos con la forma que devuelve /api/finanzas/informe/datos. */
function datosDePrueba() {
  const mes = (periodo: string, entro: number, equipo: number, gastos: number) => ({
    periodo,
    entro,
    equipo,
    gastos,
    salio: equipo + gastos,
    quedo: entro - equipo - gastos,
    pctQuedo: entro ? ((entro - equipo - gastos) / entro) * 100 : 0,
  });
  return {
    periodo: "2026-09",
    generadoEl: "2026-09-12T20:00:00.000Z",
    dolar: 1592,
    serie: [
      mes("2026-07", 4_000_000, 2_158_600, 663_759),
      mes("2026-08", 2_625_000, 2_053_500, 663_759),
      mes("2026-09", 3_235_000, 1_732_800, 663_759),
    ],
    clientes: [
      {
        cliente: "FUNDANIC",
        servicio: "Gestión de redes",
        pack: "Presencia",
        abono: 370_000,
        costoEntrega: 202_000,
        coordinacion: 37_000,
        margen: 131_000,
        margenPct: 35.4,
        desde: "2026-06-01",
        meses: 4,
      },
      {
        cliente: "Dr Humberto Dionisi",
        servicio: "Gestión de redes",
        pack: "Personalizado",
        abono: 300_000,
        costoEntrega: 236_800,
        coordinacion: 30_000,
        margen: 33_200,
        margenPct: 11.1,
        desde: "2024-03-01",
        meses: 31,
      },
    ],
    equipo: [
      { persona: "Luz Torres", porMes: { "2026-09": 638_500 }, total: 638_500 },
      { persona: "Darío", porMes: { "2026-09": 46_000 }, total: 46_000 },
    ],
    desglose: [
      {
        persona: "Luz Torres",
        roles: ["Coordinación", "Acuerdo fijo"],
        filas: [
          { cuenta: "Dr Humberto Dionisi", montos: { Coordinación: 30_000, "Acuerdo fijo": 150_000 }, total: 180_000 },
          { cuenta: "FUNDANIC", montos: { Coordinación: 37_000 }, total: 37_000 },
        ],
        total: 638_500,
        pagado: 638_500,
        falta: 0,
      },
      {
        persona: "Darío",
        roles: ["Diseño"],
        filas: [{ cuenta: "FUNDANIC", montos: { Diseño: 46_000 }, total: 46_000 }],
        total: 46_000,
        pagado: 30_000,
        falta: 16_000,
      },
    ],
    fijos: [
      { concepto: "Monotributo — 2026-09", proveedor: "Monotributo", montoOriginal: 40_000, moneda: "ARS", montoARS: 40_000 },
      { concepto: "Anthropic — 2026-09", proveedor: "Anthropic", montoOriginal: 30, moneda: "USD", montoARS: 47_760 },
    ],
    cobros: [
      { cliente: "Résonar", periodo: "2026-09", concepto: "Abono", monto: 350_000, moneda: "ARS", cobrado: false, fechaCobro: null, aCuenta: 0, saldo: 350_000 },
      { cliente: "FUNDANIC", periodo: "2026-09", concepto: "Abono", monto: 370_000, moneda: "ARS", cobrado: true, fechaCobro: "2026-09-11", aCuenta: 0, saldo: 0 },
    ],
    movimientos: [
      { fecha: "2026-09-12", tipo: "Cobro", contraparte: "FUNDANIC", concepto: "Abono", montoARS: 370_000 },
      { fecha: "2026-09-12", tipo: "Equipo", contraparte: "Luz Torres", concepto: "Sueldo", montoARS: -638_500 },
    ],
    cuadres: [
      { concepto: "Lo que entró", a: 3_235_000, b: 3_235_000, hojaA: "Resumen", hojaB: "Cobros", cierra: true },
    ],
    margenes: { minimo: 25, sano: 40, comisionCierre: 15, plusPrimerMes: 10_000 },
  };
}

const HOJAS = [
  "Cómo leer esto",
  "1. Resumen",
  "2. Clientes",
  "3. Equipo",
  "4. Gastos fijos",
  "5. Cobros",
  "6. Movimientos",
];

describe("el script de Google Sheets, corriendo de verdad", () => {
  let construir: (d: unknown, ss: unknown) => void;

  beforeAll(() => {
    instalarGlobales();
    construir = eval(INFORME_GS) as typeof construir;
  });

  it("arma las siete hojas en una planilla nueva", () => {
    const { planilla, errores, hojas } = planillaSimulada();
    construir(datosDePrueba(), planilla);
    expect(errores).toEqual([]);
    expect([...hojas.keys()].sort()).toEqual([...HOJAS].sort());
  });

  it("🔴 no se sale de los límites cuando una hoja vieja tiene MENOS columnas", () => {
    // Es el bug real: al sumarle la columna Promedio al Resumen, la hoja que
    // había quedado de la corrida anterior tenía 4 columnas y el script pedía 5.
    const { planilla, errores } = planillaSimulada({
      "1. Resumen": { cols: 4, rows: 200 },
      "3. Equipo": { cols: 5, rows: 200 },
      "2. Clientes": { cols: 7, rows: 200 },
    });
    construir(datosDePrueba(), planilla);
    expect(errores).toEqual([]);
  });

  it("tampoco cuando la hoja vieja tiene UNA sola columna", () => {
    const { planilla, errores } = planillaSimulada({
      "1. Resumen": { cols: 1, rows: 50 },
      "6. Movimientos": { cols: 1, rows: 50 },
    });
    construir(datosDePrueba(), planilla);
    expect(errores).toEqual([]);
  });

  it("aguanta un mes sin movimientos, sin cobros pendientes y sin equipo", () => {
    const d = datosDePrueba();
    d.serie = [{ periodo: "2026-09", entro: 0, equipo: 0, gastos: 0, salio: 0, quedo: 0, pctQuedo: 0 }];
    d.desglose = [];
    d.equipo = [];
    d.cobros = d.cobros.filter((c) => c.cobrado);
    d.movimientos = [];
    d.fijos = [];
    const { planilla, errores } = planillaSimulada();
    expect(() => construir(d, planilla)).not.toThrow();
    expect(errores).toEqual([]);
  });
});
