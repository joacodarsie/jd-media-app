import { describe, expect, it } from "vitest";
import { resumirUso } from "./resumen";

describe("uso de secciones", () => {
  const filas = [
    { user_id: "a", seccion: "Tareas", dia: "2026-10-19", vistas: 5 },
    { user_id: "b", seccion: "Tareas", dia: "2026-10-19", vistas: 2 },
    { user_id: "a", seccion: "Chat equipo", dia: "2026-10-20", vistas: 1 },
    { user_id: "dueno", seccion: "Documentos", dia: "2026-10-20", vistas: 9 },
  ];
  it("ordena por visitas, cuenta personas y lista las que nadie abrió", () => {
    const r = resumirUso(filas, ["Tareas", "Chat equipo", "Documentos", "Quejas"], new Set(["dueno"]));
    expect(r.secciones).toEqual([
      { seccion: "Tareas", vistas: 7, personas: 2 },
      { seccion: "Chat equipo", vistas: 1, personas: 1 },
    ]);
    expect(r.nunca).toEqual(["Documentos", "Quejas"]);
    expect(r.dias).toBe(2);
  });
});
