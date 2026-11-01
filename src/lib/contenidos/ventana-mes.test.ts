import { describe, expect, it } from "vitest";
import { mesCargado, mesPedido, ventanaDeMes } from "./ventana-mes";

describe("ventana del calendario", () => {
  it("toma el mes de la URL o el actual", () => {
    expect(mesPedido("2026-08", "2026-11-01")).toBe("2026-08");
    expect(mesPedido("2026-13", "2026-11-01")).toBe("2026-11");
    expect(mesPedido(undefined, "2026-11-01")).toBe("2026-11");
  });
  it("incluye el mes anterior y el siguiente, también al cambiar de año", () => {
    expect(ventanaDeMes("2026-12")).toEqual({ desde: "2026-11-01", hasta: "2027-02-01" });
    expect(ventanaDeMes("2027-01")).toEqual({ desde: "2026-12-01", hasta: "2027-03-01" });
  });
  it("sabe si un mes ya está cargado", () => {
    expect(mesCargado("2026-10", "2026-11")).toBe(true);
    expect(mesCargado("2026-12", "2026-11")).toBe(true);
    expect(mesCargado("2026-09", "2026-11")).toBe(false);
    expect(mesCargado("2027-01", "2026-11")).toBe(false);
  });
});
