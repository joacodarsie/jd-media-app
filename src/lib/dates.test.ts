import { describe, expect, it } from "vitest";
import { fechaHoraParaInput } from "./dates";

describe("fechaHoraParaInput", () => {
  it("muestra la hora de Córdoba, no la UTC", () => {
    expect(fechaHoraParaInput("2026-10-30T02:13:00+00:00")).toBe("2026-10-29T23:13");
  });
  it("guardar lo que muestra no corre la pieza", () => {
    const iso = "2026-10-29T13:00:00.000Z";
    expect(new Date(fechaHoraParaInput(iso) + ":00-03:00").toISOString()).toBe(iso);
  });
  it("sin fecha, nada", () => {
    expect(fechaHoraParaInput(null)).toBeNull();
  });
});
