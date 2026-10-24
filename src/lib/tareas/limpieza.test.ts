import { describe, expect, it } from "vitest";
import { diasVencida, haceCuanto, mensajeLimpieza, opcionesDePase, proximoHabil, proximoLunes, tocaRecordatorio } from "./limpieza";

describe("limpieza de vencidas", () => {
  it("el próximo hábil y el próximo lunes", () => {
    expect(proximoHabil("2026-10-21")).toBe("2026-10-22"); // miércoles → jueves
    expect(proximoHabil("2026-10-23")).toBe("2026-10-26"); // viernes → lunes
    expect(proximoHabil("2026-10-24")).toBe("2026-10-26"); // sábado → lunes
    expect(proximoLunes("2026-10-21")).toBe("2026-10-26");
    expect(proximoLunes("2026-10-26")).toBe("2026-11-02"); // un lunes → el de la otra semana
    expect(proximoLunes("2026-10-25")).toBe("2026-10-26"); // domingo → mañana
  });

  it("las fechas rápidas no se repiten", () => {
    expect(opcionesDePase("2026-10-21")).toEqual([
      { label: "Mañana", fecha: "2026-10-22" },
      { label: "El lunes", fecha: "2026-10-26" },
      { label: "En una semana", fecha: "2026-10-28" },
    ]);
    // Un viernes, «mañana» hábil ya es el lunes.
    expect(opcionesDePase("2026-10-23")).toEqual([
      { label: "El lunes", fecha: "2026-10-26" },
      { label: "En una semana", fecha: "2026-10-30" },
    ]);
  });

  it("cuánto hace que venció, dicho fácil", () => {
    expect(diasVencida("2026-10-14", "2026-10-24")).toBe(10);
    expect(haceCuanto(1)).toBe("venció ayer");
    expect(haceCuanto(5)).toBe("venció hace 5 días");
    expect(haceCuanto(10)).toBe("venció hace una semana");
    expect(haceCuanto(21)).toBe("venció hace 3 semanas");
    expect(haceCuanto(90)).toBe("venció hace 3 meses");
  });

  it("se recuerda los lunes", () => {
    expect(tocaRecordatorio("2026-10-26")).toBe(true);
    expect(tocaRecordatorio("2026-10-24")).toBe(false);
    expect(mensajeLimpieza(1)).toContain("1 tarea vencida.");
  });
});
