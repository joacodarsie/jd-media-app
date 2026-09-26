import { describe, it, expect } from "vitest";
import {
  planOnboarding,
  filasDelPlan,
  sumarDias,
  tituloMadre,
  DIAS_ONBOARDING,
  type EquipoDelCliente,
} from "./onboarding-15";

const equipo: EquipoDelCliente = {
  cm_id: "cm",
  disenador_id: "dis",
  audiovisual_id: "av",
  media_buyer_id: "mb",
  fallback: "luz",
};

const plan = (servicios: string[], eq: Partial<EquipoDelCliente> = {}) =>
  planOnboarding({ nombreCliente: "Impermax", servicios, equipo: { ...equipo, ...eq } });

describe("sumarDias", () => {
  it("cruza el fin de mes", () => {
    expect(sumarDias("2026-09-28", 15)).toBe("2026-10-13");
  });

  it("el día 0 es el mismo día", () => {
    expect(sumarDias("2026-09-13", 0)).toBe("2026-09-13");
  });
});

describe("tituloMadre", () => {
  it("lleva el nombre del cliente y es estable", () => {
    expect(tituloMadre("Impermax")).toBe("Onboarding 15 días — Impermax");
  });
});

describe("planOnboarding", () => {
  it("la gestión de redes cierra con la entrega del arranque el día 15, a cargo de la PM", () => {
    const entrega = plan(["gestion_redes"]).pasos.find((p) => p.titulo === "Entrega del arranque al cliente");
    expect(entrega).toMatchObject({ dia: 15, asignado_a_id: "luz", area: "Coordinación" });
    expect(plan(["paid_media"]).pasos.some((p) => p.titulo === "Entrega del arranque al cliente")).toBe(false);
  });

  it("toda cuenta arranca con la reunión de diagnóstico el día 1", () => {
    const p = plan(["gestion_redes"]);
    expect(p.pasos[0].titulo).toBe("Reunión de diagnóstico");
    expect(p.pasos[0].dia).toBe(1);
  });

  it("una cuenta de gestión de redes trae el arranque completo", () => {
    const t = plan(["gestion_redes"]).pasos.map((p) => p.titulo);
    expect(t).toContain("Manual de marca");
    expect(t).toContain("Lista del contenido crudo que necesitamos");
    expect(t).toContain("Calendario de contenidos para aprobar");
    expect(t).toContain("Contenido crudo ordenado en carpetas");
    expect(t).toContain("Portadas de las destacadas");
    expect(t).toContain("Aprobación del cliente y programación");
  });

  it("una cuenta de SOLO pauta no lleva calendario ni manual de marca", () => {
    const t = plan(["paid_media"]).pasos.map((p) => p.titulo);
    expect(t).not.toContain("Manual de marca");
    expect(t).not.toContain("Calendario de contenidos para aprobar");
    expect(t).toContain("Primera campaña al aire");
  });

  it("los pasos salen en orden de día", () => {
    const dias = plan(["gestion_redes", "paid_media"]).pasos.map((p) => p.dia);
    expect([...dias].sort((a, b) => a - b)).toEqual(dias);
  });

  it("respeta la secuencia dictada: crudo ordenado antes de producir", () => {
    const p = plan(["gestion_redes"]);
    const dia = (t: string) => p.pasos.find((x) => x.titulo === t)!.dia;
    expect(dia("Contenido crudo ordenado en carpetas")).toBeLessThan(dia("Piezas gráficas de los 15 días"));
    expect(dia("Calendario de contenidos para aprobar")).toBeLessThan(dia("Piezas gráficas de los 15 días"));
    expect(dia("Aprobación del cliente y programación")).toBeLessThan(DIAS_ONBOARDING);
  });

  it("NINGÚN paso queda sin responsable", () => {
    const p = plan(["gestion_redes", "paid_media", "desarrollo_web", "botly"]);
    expect(p.pasos.every((x) => !!x.asignado_a_id)).toBe(true);
    expect(p.madre.asignado_a_id).toBeTruthy();
  });

  it("sin diseñador ni editor cargados, esos pasos caen en el fallback", () => {
    const p = plan(["gestion_redes"], { disenador_id: null, audiovisual_id: null });
    const piezas = p.pasos.find((x) => x.titulo === "Piezas gráficas de los 15 días")!;
    const videos = p.pasos.find((x) => x.titulo === "Videos de los 15 días")!;
    expect(piezas.asignado_a_id).toBe("luz");
    expect(videos.asignado_a_id).toBe("luz");
  });

  it("las piezas van al diseñador y los videos al editor cuando están cargados", () => {
    const p = plan(["gestion_redes"]);
    expect(p.pasos.find((x) => x.titulo === "Piezas gráficas de los 15 días")!.asignado_a_id).toBe("dis");
    expect(p.pasos.find((x) => x.titulo === "Videos de los 15 días")!.asignado_a_id).toBe("av");
  });

  it("los pasos de pauta van al media buyer de la cuenta", () => {
    const p = plan(["paid_media"]);
    const pauta = p.pasos.filter((x) => x.area === "Paid Media");
    expect(pauta.length).toBeGreaterThan(0);
    expect(pauta.every((x) => x.asignado_a_id === "mb")).toBe(true);
  });

  it("la reunión de diagnóstico la da el CM aunque la cuenta sea solo de pauta", () => {
    const p = plan(["paid_media"]);
    expect(p.pasos.find((x) => x.titulo === "Reunión de diagnóstico")!.asignado_a_id).toBe("cm");
  });

  it("el ticket madre vence al día 15", () => {
    expect(plan(["gestion_redes"]).madre.dia).toBe(DIAS_ONBOARDING);
  });

  it("una cuenta sin servicios reconocidos igual tiene la reunión de diagnóstico", () => {
    const p = plan([]);
    expect(p.pasos).toHaveLength(1);
    expect(p.pasos[0].titulo).toBe("Reunión de diagnóstico");
  });
});

describe("filasDelPlan", () => {
  it("resuelve las fechas desde el día de arranque", () => {
    const f = filasDelPlan(plan(["gestion_redes"]), "2026-09-13");
    expect(f.madre.fecha_limite).toBe("2026-09-28");
    expect(f.pasos[0].fecha_limite).toBe("2026-09-14");
  });

  it("toda fila sale con fecha", () => {
    const f = filasDelPlan(plan(["gestion_redes", "paid_media"]), "2026-09-13");
    expect(f.pasos.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_limite))).toBe(true);
  });
});

describe("equipo incompleto", () => {
  it("cuando falta el CM, el primer paso es asignar el equipo", () => {
    const p = plan(["gestion_redes"], { cm_id: null });
    expect(p.pasos[0].titulo).toBe("Asignar el equipo de la cuenta");
    expect(p.pasos[0].asignado_a_id).toBe("luz");
  });

  it("una cuenta de redes sin diseñador también lo pide", () => {
    const t = plan(["gestion_redes"], { disenador_id: null }).pasos.map((x) => x.titulo);
    expect(t).toContain("Asignar el equipo de la cuenta");
  });

  it("una cuenta de solo pauta no reclama diseñador", () => {
    const t = plan(["paid_media"], { disenador_id: null, audiovisual_id: null }).pasos.map((x) => x.titulo);
    expect(t).not.toContain("Asignar el equipo de la cuenta");
  });

  it("con el equipo completo no aparece el paso", () => {
    const t = plan(["gestion_redes", "paid_media"]).pasos.map((x) => x.titulo);
    expect(t).not.toContain("Asignar el equipo de la cuenta");
  });
});

describe("Pack Marca Real (sin redes)", () => {
  it("no le cae el arranque de redes: brief, logo, plantillas y entrega en 10 días", () => {
    const p = plan(["branding", "marca_real"]);
    const titulos = p.pasos.map((x) => x.titulo);
    expect(titulos).toContain("Mandar el brief de marca");
    expect(titulos).toContain("2 propuestas de logo");
    expect(titulos).toContain("Entrega final");
    expect(titulos).not.toContain("Calendario de contenidos para aprobar");
    expect(titulos).not.toContain("Reunión de diagnóstico");
    expect(p.madre.dia).toBe(10);
    expect(p.pasos.find((x) => x.titulo === "2 propuestas de logo")?.asignado_a_id).toBe("dis");
  });

  it("sin diseñador cargado pide asignarlo y todo cae en la PM", () => {
    const p = plan(["branding", "marca_real"], { disenador_id: null });
    expect(p.pasos[0].titulo).toBe("Asignar quién diseña la marca");
    expect(p.pasos.find((x) => x.titulo === "2 propuestas de logo")?.asignado_a_id).toBe("luz");
  });

  it("con gestión de redes gana el arranque de redes", () => {
    const p = plan(["gestion_redes", "branding", "marca_real"]);
    expect(p.pasos.map((x) => x.titulo)).toContain("Calendario de contenidos para aprobar");
  });
});
