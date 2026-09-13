import { describe, it, expect } from "vitest";
import { avisosDeCambio, type EstadoTarea } from "./avisos";

const base: EstadoTarea = {
  asignado_a_id: "ana",
  fecha_limite: "2026-09-18",
  estado: "pendiente",
  prioridad: "media",
  titulo: "Portada destacada",
};
const t = (x: Partial<EstadoTarea> = {}): EstadoTarea => ({ ...base, ...x });

describe("avisosDeCambio", () => {
  it("avisa a quien le asignaron la tarea", () => {
    const a = avisosDeCambio(t({ asignado_a_id: null }), t(), "luz");
    expect(a).toHaveLength(1);
    expect(a[0].userId).toBe("ana");
    expect(a[0].tipo).toBe("asignacion");
    expect(a[0].mensaje).toContain("Portada destacada");
    expect(a[0].mensaje).toContain("18/09");
  });

  it("NUNCA le avisa a quien hizo el cambio", () => {
    // Es el aviso inútil que entrena a ignorar la campanita.
    const a = avisosDeCambio(t({ asignado_a_id: null }), t({ asignado_a_id: "luz" }), "luz");
    expect(a).toEqual([]);
  });

  it("avisa el cambio de fecha al responsable", () => {
    const a = avisosDeCambio(t(), t({ fecha_limite: "2026-09-25" }), "luz");
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe("fecha");
    expect(a[0].mensaje).toContain("18/09 → 25/09");
  });

  it("no manda dos avisos si te asignan y ponen fecha a la vez", () => {
    // El aviso de asignación ya trae la fecha: el segundo sería ruido.
    const a = avisosDeCambio(
      t({ asignado_a_id: null, fecha_limite: "2026-09-10" }),
      t({ asignado_a_id: "ana", fecha_limite: "2026-09-25" }),
      "luz"
    );
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe("asignacion");
  });

  it("el cambio de estado va solo a los que siguen el ticket", () => {
    const a = avisosDeCambio(t(), t({ estado: "en_revision" }), "ana", ["luz", "brisa"]);
    expect(a.map((x) => x.userId).sort()).toEqual(["brisa", "luz"]);
    expect(a[0].tipo).toBe("estado");
    expect(a[0].mensaje).toContain("en revision");
  });

  it("al responsable no se le avisa el cambio de estado: lo ve al entrar", () => {
    const a = avisosDeCambio(t(), t({ estado: "en_revision" }), "luz", ["ana"]);
    expect(a).toEqual([]);
  });

  it("un seguidor que además hizo el cambio no se avisa a sí mismo", () => {
    const a = avisosDeCambio(t(), t({ estado: "completada" }), "brisa", ["brisa", "luz"]);
    expect(a.map((x) => x.userId)).toEqual(["luz"]);
  });

  it("sin cambios no manda nada", () => {
    expect(avisosDeCambio(t(), t(), "luz", ["brisa"])).toEqual([]);
  });

  it("una persona recibe un solo aviso aunque le toquen dos cosas", () => {
    const a = avisosDeCambio(
      t({ asignado_a_id: null }),
      t({ asignado_a_id: "ana", estado: "en_progreso" }),
      "luz",
      ["ana"]
    );
    expect(a.filter((x) => x.userId === "ana")).toHaveLength(1);
  });

  it("sacar el responsable no le avisa a nadie", () => {
    // "Te sacaron de una tarea" no es accionable: es ruido.
    const a = avisosDeCambio(t(), t({ asignado_a_id: null }), "luz");
    expect(a).toEqual([]);
  });

  it("una tarea sin fecha se dice así, no 'undefined'", () => {
    const a = avisosDeCambio(
      t({ asignado_a_id: null }),
      t({ asignado_a_id: "ana", fecha_limite: null }),
      "luz"
    );
    expect(a[0].mensaje).toContain("sin fecha");
  });
});
