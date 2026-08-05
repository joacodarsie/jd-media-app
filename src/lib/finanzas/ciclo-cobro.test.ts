import { describe, it, expect } from "vitest";
import {
  COBRO_DESDE_DIA,
  SUELDOS_DIA,
  esDiaDeRecordatorio,
  estaVencido,
  periodoQueSeCobra,
  vencimientoDePeriodo,
} from "./ciclo-cobro";

describe("la ventana de cobro llega antes que los sueldos", () => {
  it("abre el 25 y los sueldos se pagan el 5: hay margen real", () => {
    expect(COBRO_DESDE_DIA).toBe(25);
    expect(SUELDOS_DIA).toBe(5);
    // La razón de ser de todo esto: cobrar ANTES de tener que pagar.
    expect(COBRO_DESDE_DIA).toBeGreaterThan(SUELDOS_DIA);
  });
});

describe("vencimientoDePeriodo", () => {
  it("vence el 1º del mes que se abona, no el 10", () => {
    expect(vencimientoDePeriodo("2026-09")).toBe("2026-09-01");
    expect(vencimientoDePeriodo("2026-12")).toBe("2026-12-01");
  });
});

describe("esDiaDeRecordatorio", () => {
  it("se manda el 25", () => {
    expect(esDiaDeRecordatorio("2026-08-25")).toBe(true);
  });

  it("no se manda el resto de los días de la ventana (sería spam)", () => {
    for (const d of ["24", "26", "28", "30", "31"]) {
      expect(esDiaDeRecordatorio(`2026-08-${d}`)).toBe(false);
    }
    expect(esDiaDeRecordatorio("2026-09-01")).toBe(false);
  });

  it("funciona en febrero, que antes dependía del último día del mes", () => {
    expect(esDiaDeRecordatorio("2026-02-25")).toBe(true);
    expect(esDiaDeRecordatorio("2026-02-28")).toBe(false);
  });
});

describe("periodoQueSeCobra", () => {
  it("del 25 en adelante se cobra el mes siguiente, por adelantado", () => {
    expect(periodoQueSeCobra("2026-08-25")).toBe("2026-09");
    expect(periodoQueSeCobra("2026-08-31")).toBe("2026-09");
  });

  it("antes del 25 se está cobrando el mes en curso (los que pagaron tarde)", () => {
    expect(periodoQueSeCobra("2026-08-01")).toBe("2026-08");
    expect(periodoQueSeCobra("2026-08-24")).toBe("2026-08");
  });

  it("cruza bien el fin de año", () => {
    expect(periodoQueSeCobra("2026-12-25")).toBe("2027-01");
    expect(periodoQueSeCobra("2026-12-24")).toBe("2026-12");
  });
});

describe("estaVencido", () => {
  it("el 1º todavía no está vencido: es el último día de la ventana", () => {
    expect(estaVencido("2026-09", "2026-09-01")).toBe(false);
  });

  it("del 2 en adelante sí", () => {
    expect(estaVencido("2026-09", "2026-09-02")).toBe(true);
  });

  it("durante la ventana previa no está vencido", () => {
    expect(estaVencido("2026-09", "2026-08-25")).toBe(false);
  });
});
