import { describe, it, expect } from "vitest";
import { armarVencidas, diasEntre, tipoDeTarea, type TareaVencidaInput } from "./vencidas";

const HOY = "2026-09-24";
const t = (id: string, over: Partial<TareaVencidaInput> = {}): TareaVencidaInput => ({
  id,
  numero: null,
  titulo: id,
  fecha_limite: "2026-09-20",
  estado: "pendiente",
  asignado_a_id: "luz",
  cliente_id: null,
  ...over,
});
const personas = [
  { id: "luz", nombre: "Luz" },
  { id: "santi", nombre: "Santiago" },
  { id: "sol", nombre: "Sol" },
];

describe("tipoDeTarea", () => {
  it("reconoce las piezas del calendario", () => {
    expect(tipoDeTarea({ titulo: "Editar pieza: Reel · Magic" })).toBe("pieza");
    expect(tipoDeTarea({ titulo: "Diseñar pieza: Posteo" })).toBe("pieza");
    expect(tipoDeTarea({ titulo: "Hacer historia: Mito o verdad" })).toBe("pieza");
  });
  it("reconoce la reunión mensual", () => {
    expect(tipoDeTarea({ titulo: "Reunión mensual — Magic — 2026-09" })).toBe("reunion");
  });
  it("un paso del arranque se reconoce por su madre", () => {
    expect(tipoDeTarea({ titulo: "Manual de marca", madre_titulo: "Onboarding 15 días — Wowitos" })).toBe("arranque");
    expect(tipoDeTarea({ titulo: "Manual de marca" })).toBe("otra");
  });
});

describe("diasEntre", () => {
  it("cuenta días calendario", () => {
    expect(diasEntre("2026-09-20", HOY)).toBe(4);
    expect(diasEntre("2026-08-31", "2026-09-01")).toBe(1);
  });
});

describe("armarVencidas", () => {
  it("deja afuera lo que no venció o ya está cerrado", () => {
    const r = armarVencidas({
      tareas: [
        t("hoy", { fecha_limite: HOY }),
        t("hecha", { estado: "completada" }),
        t("archivada", { estado: "archivada" }),
        t("vencida"),
      ],
      personas,
      hoy: HOY,
    });
    expect(r).toHaveLength(1);
    expect(r[0].tareas.map((x) => x.id)).toEqual(["vencida"]);
  });

  it("agrupa por persona, primero quien más tiene, y la más atrasada arriba", () => {
    const r = armarVencidas({
      tareas: [
        t("sol1", { asignado_a_id: "sol" }),
        t("luz-nueva", { fecha_limite: "2026-09-22" }),
        t("luz-vieja", { fecha_limite: "2026-08-01" }),
      ],
      personas,
      hoy: HOY,
    });
    expect(r.map((g) => g.persona?.nombre)).toEqual(["Luz", "Sol"]);
    expect(r[0].tareas.map((x) => x.id)).toEqual(["luz-vieja", "luz-nueva"]);
    expect(r[0].masVieja).toBe(54);
  });

  it("las que no tienen a nadie van en su propio grupo", () => {
    const r = armarVencidas({
      tareas: [t("x", { asignado_a_id: null })],
      personas,
      hoy: HOY,
    });
    expect(r[0].persona).toBeNull();
  });
});
