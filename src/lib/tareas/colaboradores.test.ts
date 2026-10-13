import { describe, expect, it } from "vitest";
import { esDe, filtroDePersona } from "./colaboradores";

describe("tareas con colaboradores", () => {
  it("es mía si soy el responsable o colaboro", () => {
    expect(esDe({ asignado_a_id: "a", colaboradores: [] }, "a")).toBe(true);
    expect(esDe({ asignado_a_id: "a", colaboradores: ["b", "c"] }, "c")).toBe(true);
    expect(esDe({ asignado_a_id: "a", colaboradores: ["b"] }, "z")).toBe(false);
    // Las que vienen sin la columna (pantallas viejas) siguen andando.
    expect(esDe({ asignado_a_id: "a" }, "a")).toBe(true);
    expect(esDe({ asignado_a_id: null, colaboradores: null }, "a")).toBe(false);
  });
  it("filtro para la base", () => {
    expect(filtroDePersona("u1")).toBe("asignado_a_id.eq.u1,colaboradores.cs.{u1}");
  });
});
