import { describe, expect, it } from "vitest";
import { DEFAULT_AGENCY_SETTINGS } from "@/lib/coordinacion";
import { comoCobras, proximoCobro } from "./como-cobras";

const r = DEFAULT_AGENCY_SETTINGS.rates;

describe("comoCobras", () => {
  it("diseño cobra por pieza y portada", () => {
    const l = comoCobras({ rol: "diseno", area: "Diseño" }, r).join(" ");
    expect(l).toContain("$8.000");
    expect(l).toContain("$2.000");
  });
  it("comercial solo a variable no ve el fijo; el otro sí", () => {
    expect(comoCobras({ rol: "comercial", area: "Comercial", comercial_sin_fijo: true }, r).join(" ")).not.toContain("Fijo");
    expect(comoCobras({ rol: "comercial", area: "Comercial" }, r).join(" ")).toContain("Fijo mensual");
    expect(comoCobras({ rol: "comercial", area: "Comercial" }, r).join(" ")).toContain("cada uno cobra la mitad");
  });
  it("dirección creativa + comercial suman las dos cosas", () => {
    const l = comoCobras({ rol: "coordinador", rol_secundario: "comercial", area: "Comercial", area_secundaria: "Coordinación de Diseño" }, r);
    expect(l.some((x) => x.includes("cada cuenta que dirigís"))).toBe(true);
    expect(l.some((x) => x.includes("cada cuenta que cerrás"))).toBe(true);
  });
});

describe("proximoCobro", () => {
  it("lo de octubre se paga el 7 de noviembre", () => {
    expect(proximoCobro("2026-10-21")).toEqual({ fecha: "2026-11-07", periodo: "2026-10" });
  });
  it("antes del 7 todavía se está por pagar el mes anterior", () => {
    expect(proximoCobro("2026-11-03")).toEqual({ fecha: "2026-11-07", periodo: "2026-10" });
  });
  it("diciembre se paga el 7 de enero", () => {
    expect(proximoCobro("2026-12-15")).toEqual({ fecha: "2027-01-07", periodo: "2026-12" });
  });
});
