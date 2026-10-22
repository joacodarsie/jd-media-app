import { describe, expect, it } from "vitest";
import { avisoRespuesta, pedirEncuestaEnPortal } from "./encuesta-portal";

describe("encuesta en el portal", () => {
  const base = { fechaInicio: "2026-09-01", hoy: "2026-10-19", yaRespondio: false };
  it("se pide en la segunda quincena a quien lleva un mes", () => {
    expect(pedirEncuestaEnPortal(base)).toBe(true);
  });
  it("no antes del 15, ni si ya contestó, ni a una cuenta recién llegada", () => {
    expect(pedirEncuestaEnPortal({ ...base, hoy: "2026-10-14" })).toBe(false);
    expect(pedirEncuestaEnPortal({ ...base, yaRespondio: true })).toBe(false);
    expect(pedirEncuestaEnPortal({ ...base, fechaInicio: "2026-10-01" })).toBe(false);
    expect(pedirEncuestaEnPortal({ ...base, fechaInicio: null })).toBe(false);
  });
  it("un 3 o menos es alarma", () => {
    expect(avisoRespuesta("Magic", 3, "más videos")).toMatch(/^🚨 Magic puso 3\/5.*«más videos».*Llamalo/);
    expect(avisoRespuesta("Magic", 5, "")).toBe("⭐ Magic puso 5/5 en la encuesta del mes.");
  });
});

describe("encuesta después de la reunión (22/10/2026)", () => {
  it("con la reunión reciente se pide aunque sea la primera quincena", () => {
    expect(pedirEncuestaEnPortal({ fechaInicio: "2026-07-01", hoy: "2026-11-04", yaRespondio: false })).toBe(false);
    expect(pedirEncuestaEnPortal({ fechaInicio: "2026-07-01", hoy: "2026-11-04", yaRespondio: false, reunionReciente: true })).toBe(true);
    expect(pedirEncuestaEnPortal({ fechaInicio: "2026-07-01", hoy: "2026-11-04", yaRespondio: true, reunionReciente: true })).toBe(false);
    // Una cuenta de menos de 25 días no, aunque haya tenido reunión.
    expect(pedirEncuestaEnPortal({ fechaInicio: "2026-10-20", hoy: "2026-11-04", yaRespondio: false, reunionReciente: true })).toBe(false);
  });
});
