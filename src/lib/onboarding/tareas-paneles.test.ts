import { describe, expect, it } from "vitest";
import { descripcionConFaltantes, tareasDePaneles } from "./tareas-paneles";

const equipo = {
  dueno: "jo",
  coordinador_id: "luz",
  director_creativo_id: "santi",
  cm_id: "sol",
  disenador_id: "bri",
  media_buyer_id: null,
  fallback: "pm",
};

describe("tareas de las pestañas del onboarding", () => {
  it("una por pestaña, para quien la tiene a cargo, con la fecha del arranque", () => {
    const t = tareasDePaneles({ clienteId: "c1", nombreCliente: "CATCH", servicios: { gestionRedes: true, disenoGrafico: false, paidMedia: false }, equipo });
    expect(t.map((x) => [x.panel, x.asignado_a_id, x.dia])).toEqual([
      ["inicial", "jo", 1],
      ["redes", "luz", 2],
      ["creativa", "santi", 4],
      ["cm", "sol", 7],
      ["diseno", "bri", 5],
      // Sin media buyer cargado, cae en la project manager.
      ["pauta", "pm", 10],
    ]);
    expect(t[2].titulo).toBe("Completar el onboarding de Creativa — CATCH");
    expect(t[2].rutina_key).toBe("onb-panel:c1:creativa");
    expect(t[2].descripcion).toContain("/clientes/c1/onboarding/creativa");
    expect(t[5].descripcion).toContain("/clientes/c1/pauta");
  });

  it("solo las pestañas que corresponden a lo que contrató", () => {
    const t = tareasDePaneles({ clienteId: "c1", nombreCliente: "X", servicios: { gestionRedes: false, disenoGrafico: true, paidMedia: false }, equipo });
    expect(t.map((x) => x.panel)).toEqual(["inicial", "diseno"]);
  });

  it("la descripción dice qué falta", () => {
    expect(descripcionConFaltantes("Base.", ["Kit de marca", "Plantillas"])).toBe("Base.\n\n**Falta:**\n- Kit de marca\n- Plantillas");
    expect(descripcionConFaltantes("Base.", [])).toBe("Base.");
  });
});

describe("áreas válidas en la base (is_area)", () => {
  it("cada tarea usa un área que la base acepta", () => {
    const validas = ["Estrategia/Dirección", "Coordinación", "Coordinación de Diseño", "Community Manager", "Diseño", "Paid Media"];
    const t = tareasDePaneles({ clienteId: "c", nombreCliente: "X", servicios: { gestionRedes: true, disenoGrafico: true, paidMedia: true }, equipo });
    for (const x of t) expect(validas).toContain(x.area);
  });
});
