import { describe, expect, it } from "vitest";
import { tareaSeguimientoDiagnostico } from "./seguimiento-diagnostico";

describe("seguimiento del diagnóstico de la web", () => {
  it("arma la tarea con lo que le falta y el mensaje listo", () => {
    const t = tareaSeguimientoDiagnostico({ usuario: "panaderialuz", nombre: "Panadería Luz", puntaje: 42, mejoras: ["Publicá al menos 3 veces por semana.", "Sumá reels."] });
    expect(t.titulo).toBe("🔎 Escribirle a @panaderialuz: hizo el diagnóstico en la web");
    expect(t.descripcion).toContain("- Publicá al menos 3 veces por semana.\n- Sumá reels.");
    expect(t.descripcion).toContain("te dio 42/100). Lo primero que vemos para mejorar: publicá al menos 3 veces por semana.");
  });
});
