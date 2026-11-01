import { describe, expect, it } from "vitest";
import { periodoDeRutina } from "./rutinas-vencidas";

describe("periodoDeRutina", () => {
  it("reconoce las rutinas de un mes o una semana", () => {
    expect(periodoDeRutina("dir:2026-10:rrhh")).toBe("2026-10");
    expect(periodoDeRutina("dir:2026-10-26:ronda")).toBe("2026-10");
    expect(periodoDeRutina("rojo:abc-123:2026-10")).toBe("2026-10");
    expect(periodoDeRutina("ref:momento:abc:2026-10")).toBe("2026-10");
    expect(periodoDeRutina("2026-10:gads:abc")).toBe("2026-10");
  });
  it("deja afuera lo que sigue valiendo", () => {
    expect(periodoDeRutina("2026-10:encuesta")).toBeNull();
    expect(periodoDeRutina("dir:2026-T4:clima")).toBeNull();
    expect(periodoDeRutina("onb-panel:abc:creativa")).toBeNull();
    expect(periodoDeRutina("vincular-ig:abc")).toBeNull();
  });
});
