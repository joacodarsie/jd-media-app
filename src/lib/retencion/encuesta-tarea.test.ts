import { describe, expect, it } from "vitest";
import { faltanEncuesta, tareaEncuesta } from "./encuesta-tarea";

describe("tarea de la encuesta del mes", () => {
  const cuentas = [
    { id: "a", nombre: "A", fechaInicio: "2026-08-01" },
    { id: "b", nombre: "B", fechaInicio: "2026-08-01" },
    { id: "c", nombre: "C", fechaInicio: "2026-10-10" },
  ];
  it("solo las que llevan un mes y no contestaron", () => {
    expect(faltanEncuesta(cuentas, new Set(["b"]), "2026-10-19").map((c) => c.id)).toEqual(["a"]);
    expect(faltanEncuesta(cuentas, new Set(), "2026-10-10")).toEqual([]);
  });
  it("la tarea lista las que faltan", () => {
    const t = tareaEncuesta("octubre 2026", [cuentas[0]]);
    expect(t.titulo).toBe("📝 Mandar la encuesta de octubre 2026");
    expect(t.descripcion).toContain("**Faltan (1):** A.");
  });
});
