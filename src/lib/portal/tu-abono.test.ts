import { describe, expect, it } from "vitest";
import { clavePago, mostrarAbono } from "./tu-abono";

describe("Tu abono en el portal", () => {
  it("del 1 al 10, si no pagó y no arrancó este mes", () => {
    expect(mostrarAbono({ hoy: "2026-11-03", fechaInicio: "2026-08-01", pagado: false })).toBe(true);
    expect(mostrarAbono({ hoy: "2026-11-11", fechaInicio: "2026-08-01", pagado: false })).toBe(false);
    expect(mostrarAbono({ hoy: "2026-11-03", fechaInicio: "2026-08-01", pagado: true })).toBe(false);
    expect(mostrarAbono({ hoy: "2026-11-03", fechaInicio: "2026-11-01", pagado: false })).toBe(false);
    expect(mostrarAbono({ hoy: "2026-11-03", fechaInicio: null, pagado: false })).toBe(false);
  });
  it("una tarea por cuenta y mes", () => {
    expect(clavePago("abc", "2026-11")).toBe("pago:abc:2026-11");
  });
});
