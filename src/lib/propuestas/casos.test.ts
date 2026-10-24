import { describe, expect, it } from "vitest";
import { casosParaPropuesta, rubroDeCliente, type CasoConRubro } from "./casos";

const caso = (nombre: string, rubro: string | null): CasoConRubro => ({
  nombre,
  rubro,
  usuario: null,
  meses: 3,
  antes: { fecha: "2026-07-01", grilla: [] },
  hoy: { fecha: "2026-10-01", grilla: [] },
  logros: [],
});

describe("casos de éxito en la propuesta", () => {
  it("el rubro escrito a mano en la ficha se reconoce", () => {
    expect(rubroDeCliente("Turismo / Cabañas y suites")).toBe("hoteleria");
    expect(rubroDeCliente("Salud")).toBe("salud");
    expect(rubroDeCliente("Decoraciones, ambientaciones")).toBe("eventos");
    expect(rubroDeCliente("Interiorismo")).toBe("arquitectura");
    expect(rubroDeCliente("Fundación de Autismo")).toBe("ong");
    expect(rubroDeCliente("Automotor")).toBe("automotor");
    expect(rubroDeCliente("Música Tecno")).toBeNull();
    expect(rubroDeCliente(null)).toBeNull();
  });

  it("primero el del rubro del prospecto, después los más fuertes", () => {
    const casos = [caso("Ansenuza", "Turismo / Eventos"), caso("Amelia", "Decoraciones"), caso("Dionisi", "Salud")];
    expect(casosParaPropuesta(casos, "salud").map((c) => [c.nombre, c.mismoRubro])).toEqual([
      ["Dionisi", true],
      ["Ansenuza", false],
    ]);
    expect(casosParaPropuesta(casos, null).map((c) => c.nombre)).toEqual(["Ansenuza", "Amelia"]);
    expect(casosParaPropuesta([], "salud")).toEqual([]);
  });
});
