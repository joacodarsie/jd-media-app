import { describe, expect, it } from "vitest";
import { isPlanOfPastMonth } from "@/lib/content-plans/staleness";

const JUL_2026 = new Date("2026-07-14T12:00:00");

describe("isPlanOfPastMonth", () => {
  it("plan de un mes anterior → viejo", () => {
    expect(isPlanOfPastMonth("Junio 2026", JUL_2026)).toBe(true);
    expect(isPlanOfPastMonth("junio de 2026", JUL_2026)).toBe(true);
    expect(isPlanOfPastMonth("Diciembre 2025", JUL_2026)).toBe(true);
  });

  it("plan del mes en curso o futuro → vigente", () => {
    expect(isPlanOfPastMonth("Julio 2026", JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth("Agosto 2026", JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth("Enero 2027", JUL_2026)).toBe(false);
  });

  it("labels libres o vacíos no se tocan", () => {
    expect(isPlanOfPastMonth("Q2 2026", JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth("Lanzamiento del álbum", JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth("", JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth(null, JUL_2026)).toBe(false);
    expect(isPlanOfPastMonth(undefined, JUL_2026)).toBe(false);
  });

  it("acepta acentos y mayúsculas", () => {
    // setiembre/septiembre, case-insensitive
    expect(isPlanOfPastMonth("SETIEMBRE 2025", JUL_2026)).toBe(true);
    expect(isPlanOfPastMonth("Septiembre 2026", JUL_2026)).toBe(false);
  });
});
