import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { INFORME_GS } from "./informe-gs";

/**
 * El cuerpo del script vive en dos lados: el .gs (que se edita) y el módulo TS
 * (que la app sirve). Si alguien toca el .gs y se olvida de correr
 * `node scripts/build-informe-gs.mjs`, la planilla del dueño seguiría corriendo
 * el código viejo sin que nadie se entere. Esto lo agarra.
 */
describe("el cuerpo del script de Google Sheets", () => {
  it("el módulo TS está sincronizado con el .gs", () => {
    const gs = fs.readFileSync("scripts/informe-cuerpo.gs", "utf8");
    expect(INFORME_GS).toBe(gs);
  });

  it("es un IIFE que devuelve la función de entrada", () => {
    // El cargador hace `var construir = eval(codigo)`: si no devolviera nada,
    // fallaría recién en la planilla del dueño.
    expect(INFORME_GS.trimStart()).toMatch(/^\/\*\*/);
    expect(INFORME_GS.trimEnd()).toMatch(/return construir;\s*\}\)\(\)$/);
  });

  it("es JavaScript válido", () => {
    // Apps Script no tiene compilador: un error de sintaxis se descubre cuando
    // el dueño aprieta el botón. Mejor que falle acá.
    expect(() => new Function("return " + INFORME_GS)).not.toThrow();
  });

  it("define las siete hojas", () => {
    for (const h of ["hojaGuia", "hojaResumen", "hojaClientes", "hojaEquipo", "hojaGastosFijos", "hojaCobros", "hojaMovimientos"]) {
      expect(INFORME_GS).toContain("function " + h);
    }
  });
});
