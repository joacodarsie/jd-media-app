import { describe, it, expect } from "vitest";
import { esVencidaReciente, inicioVentanaVencidas } from "../dates";

/**
 * Regla que pidió Luz: en "Mi día" no pueden aparecer como vencidas tareas de
 * mayo. Como mucho, las del mes actual.
 */
describe("inicioVentanaVencidas", () => {
  it("a mitad de mes, la ventana arranca el 1° de ese mes", () => {
    expect(inicioVentanaVencidas("2026-07-30")).toBe("2026-07-01");
    expect(inicioVentanaVencidas("2026-07-08")).toBe("2026-07-01");
  });

  it("en los primeros 7 días mira también el mes anterior completo", () => {
    // El 3 de agosto, lo del 28 de julio todavía es reciente.
    expect(inicioVentanaVencidas("2026-08-03")).toBe("2026-07-01");
    expect(inicioVentanaVencidas("2026-08-07")).toBe("2026-07-01");
  });

  it("cruza bien el cambio de año", () => {
    expect(inicioVentanaVencidas("2027-01-02")).toBe("2026-12-01");
    expect(inicioVentanaVencidas("2027-01-20")).toBe("2027-01-01");
  });
});

describe("esVencidaReciente", () => {
  const HOY = "2026-07-30";

  it("las de mayo NO cuentan (el caso que reportó Luz)", () => {
    expect(esVencidaReciente("2026-05-14", HOY)).toBe(false);
    expect(esVencidaReciente("2026-06-30", HOY)).toBe(false);
  });

  it("las de este mes sí", () => {
    expect(esVencidaReciente("2026-07-01", HOY)).toBe(true);
    expect(esVencidaReciente("2026-07-29", HOY)).toBe(true);
  });

  it("la de hoy y las futuras no son vencidas", () => {
    expect(esVencidaReciente(HOY, HOY)).toBe(false);
    expect(esVencidaReciente("2026-08-05", HOY)).toBe(false);
  });

  it("tolera timestamp completo y fecha vacía", () => {
    expect(esVencidaReciente("2026-07-15T12:00:00.000Z", HOY)).toBe(true);
    expect(esVencidaReciente(null, HOY)).toBe(false);
    expect(esVencidaReciente(undefined, HOY)).toBe(false);
  });

  it("a principio de mes conserva lo del mes anterior", () => {
    expect(esVencidaReciente("2026-07-28", "2026-08-03")).toBe(true);
    expect(esVencidaReciente("2026-06-28", "2026-08-03")).toBe(false);
  });
});
