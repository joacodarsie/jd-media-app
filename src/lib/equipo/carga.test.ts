import { describe, expect, it } from "vitest";
import { cargaDe } from "./carga";

describe("carga de trabajo", () => {
  it("compara lo que tiene con lo que suele cerrar", () => {
    expect(cargaDe({ pendientes7: 10, vencidas: 6, cerradas28: 40 })).toMatchObject({ pendientes: 16, capacidad: 10, ratio: 1.6, nivel: "desbordado" });
    expect(cargaDe({ pendientes7: 9, vencidas: 0, cerradas28: 40 })).toMatchObject({ nivel: "al_limite" });
    expect(cargaDe({ pendientes7: 3, vencidas: 0, cerradas28: 40 })).toMatchObject({ nivel: "bien" });
  });
  it("sin historia, solo alarma con mucho vencido", () => {
    expect(cargaDe({ pendientes7: 4, vencidas: 1, cerradas28: 2 }).nivel).toBe("sin_datos");
    expect(cargaDe({ pendientes7: 0, vencidas: 6, cerradas28: 0 }).nivel).toBe("desbordado");
  });
});
