import { describe, it, expect } from "vitest";
import {
  COBRO_HASTA_DIA,
  SUELDOS_DIA,
  VENTANA_COBRO_TEXTO,
  esDiaDeRecordatorio,
  estaVencido,
  periodoQueSeCobra,
  vencimientoDePeriodo,
} from "./ciclo-cobro";

describe("la ventana de cobro cierra antes que los sueldos", () => {
  it("se cobra hasta el 5 y los sueldos se pagan el 7", () => {
    expect(COBRO_HASTA_DIA).toBe(5);
    expect(SUELDOS_DIA).toBe(7);
    // La razón de ser de todo esto: cobrar ANTES de tener que pagar.
    expect(COBRO_HASTA_DIA).toBeLessThan(SUELDOS_DIA);
  });

  it("la carta acuerdo dice del 1 al 5", () => {
    expect(VENTANA_COBRO_TEXTO).toBe("entre el 1 y el 5 de cada mes");
  });
});

describe("vencimientoDePeriodo", () => {
  it("vence el 5 del mes que se abona", () => {
    expect(vencimientoDePeriodo("2026-10")).toBe("2026-10-05");
    expect(vencimientoDePeriodo("2026-12")).toBe("2026-12-05");
  });
});

describe("esDiaDeRecordatorio", () => {
  it("se manda el 1, cuando abre la ventana", () => {
    expect(esDiaDeRecordatorio("2026-10-01")).toBe(true);
  });

  it("no se manda el resto de los días (sería spam)", () => {
    for (const d of ["02", "05", "25", "30"]) {
      expect(esDiaDeRecordatorio(`2026-10-${d}`)).toBe(false);
    }
  });
});

describe("periodoQueSeCobra", () => {
  it("siempre es el mes en curso: se cobra por adelantado dentro del mismo mes", () => {
    expect(periodoQueSeCobra("2026-10-01")).toBe("2026-10");
    expect(periodoQueSeCobra("2026-10-28")).toBe("2026-10");
    expect(periodoQueSeCobra("2026-12-31")).toBe("2026-12");
  });
});

describe("estaVencido", () => {
  it("el 5 todavía no está vencido: es el último día de la ventana", () => {
    expect(estaVencido("2026-10", "2026-10-05")).toBe(false);
  });

  it("del 6 en adelante sí", () => {
    expect(estaVencido("2026-10", "2026-10-06")).toBe(true);
  });

  it("antes de que abra la ventana no está vencido", () => {
    expect(estaVencido("2026-10", "2026-09-28")).toBe(false);
  });
});
