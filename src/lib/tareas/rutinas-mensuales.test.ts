import { describe, it, expect } from "vitest";
import { rutinasDelMes, mesLabel, type GenteRutina } from "./rutinas-mensuales";

const gente: GenteRutina = { coordGeneralId: "leo", adminId: "joaco" };

describe("rutinasDelMes", () => {
  it("son las tres que se repiten todos los meses", () => {
    const out = rutinasDelMes("2026-10", gente);
    expect(out.map((t) => t.rutina_key)).toEqual([
      "2026-10:cobrar",
      "2026-10:cerrar-mes",
      "2026-10:sueldos",
    ]);
  });

  it("las fechas son las del calendario de la plata: cobros el 5, sueldos el 7", () => {
    const out = rutinasDelMes("2026-10", gente);
    const por = (k: string) => out.find((t) => t.rutina_key === k)!;
    expect(por("2026-10:cobrar").fecha_limite).toBe("2026-10-05");
    expect(por("2026-10:cerrar-mes").fecha_limite).toBe("2026-10-05");
    expect(por("2026-10:sueldos").fecha_limite).toBe("2026-10-07");
  });

  it("cobrar habla del mes en curso; cerrar y pagar, del anterior", () => {
    const out = rutinasDelMes("2026-01", gente);
    const por = (k: string) => out.find((t) => t.rutina_key === k)!;
    expect(por("2026-01:cobrar").titulo).toContain("enero de 2026");
    expect(por("2026-01:sueldos").titulo).toContain("diciembre de 2025");
    expect(por("2026-01:cerrar-mes").titulo).toContain("diciembre de 2025");
  });

  it("la plata la lleva Coordinación General; los sueldos, el dueño", () => {
    const out = rutinasDelMes("2026-10", gente);
    const por = (k: string) => out.find((t) => t.rutina_key === k)!;
    expect(por("2026-10:cobrar").asignado_a_id).toBe("leo");
    expect(por("2026-10:cerrar-mes").asignado_a_id).toBe("leo");
    expect(por("2026-10:sueldos").asignado_a_id).toBe("joaco");
  });

  it("sin Coordinación General, todo le queda al dueño", () => {
    const out = rutinasDelMes("2026-10", { coordGeneralId: null, adminId: "joaco" });
    expect(out.every((t) => t.asignado_a_id === "joaco")).toBe(true);
  });

  it("si no hay a quién asignarlas no se crean: una tarea sin responsable no existe", () => {
    expect(rutinasDelMes("2026-10", { coordGeneralId: null, adminId: null })).toHaveLength(0);
  });

  it("las claves llevan el período: correrlo de nuevo no duplica y el mes que viene son otras", () => {
    const oct = rutinasDelMes("2026-10", gente).map((t) => t.rutina_key);
    const nov = rutinasDelMes("2026-11", gente).map((t) => t.rutina_key);
    expect(new Set(oct).size).toBe(oct.length);
    expect(nov.some((k) => oct.includes(k))).toBe(false);
  });

  it("mesLabel escribe el mes en castellano", () => {
    expect(mesLabel("2026-10")).toBe("octubre de 2026");
    expect(mesLabel("2026-01")).toBe("enero de 2026");
  });
});
