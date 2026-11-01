import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { PLANILLA_GS } from "./planilla-gs";

/**
 * El cuerpo del script de la planilla vive en el .gs (que se edita) y en el
 * módulo TS (que sirve la app). Si se desincronizan, la planilla del dueño
 * corre código viejo sin que nadie se entere.
 */
describe("el script de la planilla Finanzas de Joaquín", () => {
  it("el módulo TS está sincronizado con el .gs", () => {
    // Sin los saltos de línea de Windows: git los cambia al bajar el repo.
    const sinCr = (t: string) => t.replace(/\r/g, "");
    expect(sinCr(PLANILLA_GS)).toBe(sinCr(fs.readFileSync("scripts/planilla-cuerpo.gs", "utf8")));
  });

  it("es JavaScript válido y un IIFE que devuelve lo que llama el cargador", () => {
    // Apps Script no compila: un error de sintaxis se vería recién en la planilla.
    const codigo = new Function(
      "PropertiesService",
      "SpreadsheetApp",
      "Utilities",
      "UrlFetchApp",
      "ContentService",
      "LockService",
      // Entre paréntesis: con un comentario antes, `return` solo devolvería undefined.
      "return (" + PLANILLA_GS + ")",
    )();
    for (const f of ["recibir", "diario8", "diario10", "cadaHora", "actualizarTodo", "sincronizarConApp"]) {
      expect(typeof codigo[f]).toBe("function");
    }
  });

  it("el cargador llama solo funciones que el cuerpo devuelve", () => {
    const cargador = fs.readFileSync("scripts/planilla-cargador.gs", "utf8");
    const llamadas = [...cargador.matchAll(/codigo_\(\)\.(\w+)\(/g)].map((m) => m[1]);
    expect(llamadas.length).toBeGreaterThan(0);
    for (const f of llamadas) expect(PLANILLA_GS).toMatch(new RegExp(`\\b${f}: `));
  });

  it("no lleva claves: la de MacroDroid la pasa el cargador", () => {
    expect(PLANILLA_GS).not.toMatch(/jd-[A-Za-z0-9]{20,}/);
    expect(fs.readFileSync("scripts/planilla-cargador.gs", "utf8")).toContain("PEGA_ACA_LA_CLAVE_DE_MACRODROID");
  });
});

describe("sincronizarConApp (con una planilla de mentira)", () => {
  const fecha = (s: string) => new Date(`${s}T12:00:00-03:00`);
  // A fecha, B cuenta, C descripción, D monto, ..., G categoría, H detalle, K ¿en la app?, P monto ARS, Q ID
  const fila = (f: string, desc: string, monto: number, cat: string, det: string, k = "", id = "") => [
    fecha(f), "Naranja X", desc, monto, "ARS", "", cat, det, "Notificación", "No", k, "", f.slice(0, 7), "", "", monto, id,
  ];
  const filas = [
    fila("2026-10-30", "viejo", 300000, "JD · Cobro de cliente", "CATCH"), // antes de noviembre: no se manda
    fila("2026-11-03", "Transferencia recibida CATCH SRL", 600000, "JD · Cobro de cliente", "CATCH", "", "op-1"),
    fila("2026-11-03", "ya mandado", 350000, "JD · Cobro de cliente", "Wowitos", "Sí: Wowitos noviembre cobrado"),
    fila("2026-11-07", "Transferencia a Luz", -832633, "JD · Pagos al equipo", "Luz Torres"),
    fila("2026-11-07", "devolución", 5000, "JD · Pagos al equipo", "Sol Britos"), // un sueldo que entra: no
    fila("2026-11-08", "super", -10000, "Supermercado", ""),
  ];

  it("manda solo los cobros y sueldos nuevos y escribe la respuesta en la columna K", () => {
    const escritos: Record<number, string> = {};
    let enviado: { movimientos: { clave: string; monto: number; detalle: string; fecha: string }[] } | null = null;
    const hoja = {
      getLastRow: () => filas.length + 1,
      getRange: (r: number, c: number) => ({
        getValues: () => filas,
        setValue: (v: string) => {
          if (c === 11) escritos[r] = v;
        },
      }),
    };
    const codigo = new Function(
      "PropertiesService", "SpreadsheetApp", "Utilities", "UrlFetchApp", "ContentService", "LockService",
      "return (" + PLANILLA_GS + ")",
    )(
      { getScriptProperties: () => ({ getProperty: () => "tok" }) },
      { getActive: () => ({ getSheetByName: () => hoja }) },
      {
        formatDate: (d: Date) => d.toISOString().slice(0, 10),
        computeDigest: (_a: unknown, s: string) => [...s].map((ch) => ch.charCodeAt(0)),
        DigestAlgorithm: { SHA_256: 1 },
        Charset: { UTF_8: 1 },
        base64EncodeWebSafe: (b: number[]) => Buffer.from(b.map((x) => x & 255)).toString("base64url"),
      },
      {
        fetch: (_url: string, opts: { payload: string }) => {
          enviado = JSON.parse(opts.payload);
          return {
            getResponseCode: () => 200,
            getContentText: () =>
              JSON.stringify({
                resultados: enviado!.movimientos.map((m) => ({
                  clave: m.clave,
                  estado: m.detalle === "CATCH" ? "marcado" : "sin_match",
                  mensaje: m.detalle === "CATCH" ? "CATCH noviembre cobrado" : "No encontré a quién",
                })),
              }),
          };
        },
      },
      {}, {},
    );

    expect(codigo.sincronizarConApp()).toBe(2);
    expect(enviado!.movimientos.map((m) => [m.detalle, m.monto, m.fecha])).toEqual([
      ["CATCH", 600000, "2026-11-03"],
      ["Luz Torres", 832633, "2026-11-07"],
    ]);
    // El ID de la operación, si lo hay, es la clave; si no, una sacada del movimiento.
    expect(enviado!.movimientos[0].clave).toBe("op-1");
    expect(enviado!.movimientos[1].clave).toMatch(/^p-/);
    expect(escritos).toEqual({ 3: "Sí: CATCH noviembre cobrado", 5: "No: No encontré a quién" });
  });
});
