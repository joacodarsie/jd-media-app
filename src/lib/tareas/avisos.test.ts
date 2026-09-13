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
  it("NO avisa la asignación: ya la avisa un trigger de la base", () => {
    // Verificado el 13/9 con una tarea de prueba: el trigger notify_assignment
    // ya manda el aviso, así que hacerlo también acá le llegaba duplicado.
    const a = avisosDeCambio(t({ asignado_a_id: null }), t(), "luz");
    expect(a).toEqual([]);
  });

  it("avisa el cambio de fecha al responsable", () => {
    const a = avisosDeCambio(t(), t({ fecha_limite: "2026-09-25" }), "luz");
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe("fecha");
    expect(a[0].mensaje).toContain("18/09 → 25/09");
  });

  it("si te asignan y ponen fecha a la vez, no manda el de fecha", () => {
    // El aviso de asignación (del trigger) ya trae la tarea: el de fecha sería
    // un segundo aviso por el mismo movimiento.
    const a = avisosDeCambio(
      t({ asignado_a_id: null, fecha_limite: "2026-09-10" }),
      t({ asignado_a_id: "ana", fecha_limite: "2026-09-25" }),
      "luz"
    );
    expect(a).toEqual([]);
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
    // Le cambian la fecha Y el estado: va uno solo.
    const a = avisosDeCambio(
      t(),
      t({ fecha_limite: "2026-09-25", estado: "en_progreso" }),
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
    const a = avisosDeCambio(t(), t({ fecha_limite: null }), "luz");
    expect(a[0].mensaje).toContain("sin fecha");
  });
});
