import { describe, expect, it } from "vitest";
import { elegirCasos, haceCuanto, resumirEnVivo, type CandidatoCaso } from "./vitrina";

const grilla = (n: number) => Array.from({ length: n }, (_, i) => ({ img: `x${i}.jpg`, permalink: null, tipo: "IMAGE", fecha: "2026-10-01" }));
const comp = (clave: "seguidores" | "posts_mes" | "interaccion" | "reels", antes: number, hoy: number) => ({
  clave, titulo: clave, antes, hoy, cambio: "+", mejoro: hoy > antes, explicacion: "",
});

const cand = (nombre: string, comparaciones: CandidatoCaso["comparaciones"], g = 9): CandidatoCaso => ({
  nombre, usuario: nombre, meses: 3,
  antes: { fecha: "2026-07-01", grilla: grilla(g) },
  hoy: { fecha: "2026-10-17", grilla: grilla(9) },
  comparaciones,
});

describe("elegirCasos", () => {
  it("solo cuentas con una mejora fuerte y el hoy completo; muestra solo lo que mejoró", () => {
    const casos = elegirCasos([
      cand("A", [comp("seguidores", 546, 1164), comp("posts_mes", 2, 4), comp("interaccion", 50, 30)]),
      cand("B", [comp("posts_mes", 0, 6), comp("seguidores", 100, 90)]),
      cand("C", [comp("posts_mes", 0, 11), comp("reels", 0, 5)], 0),
      cand("D", [comp("seguidores", 1000, 1050)]),
    ]);
    expect(casos.map((c) => c.nombre)).toEqual(["B", "A"]);
    expect(casos[1].logros.map((l) => l.titulo)).toEqual(["seguidores", "posts_mes"]);
    expect(casos[0].logros.map((l) => l.titulo)).toEqual(["posts_mes"]);
  });
});

describe("resumirEnVivo", () => {
  const AHORA = Date.parse("2026-10-17T15:00:00Z");
  const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

  it("usa la semana si alcanza", () => {
    const r = resumirEnVivo([{ marca: "A", fechas: Array.from({ length: 8 }, (_, i) => hace(i * 10 + 2)) }, { marca: "B", fechas: [hace(30), hace(40), hace(50), hace(60), hace(70)] }], AHORA);
    expect(r).toEqual({ publicaciones: 13, dias: 7, marcas: 2, ultima: { marca: "A", fecha: hace(2), hace: "hace 2 horas" } });
  });

  it("si la semana es flaca muestra el mes", () => {
    const r = resumirEnVivo([{ marca: "A", fechas: [hace(5), hace(24 * 20)] }], AHORA);
    expect(r.dias).toBe(30);
    expect(r.publicaciones).toBe(2);
  });

  it("haceCuanto", () => {
    expect(haceCuanto(hace(0.5), AHORA)).toBe("hace 30 min");
    expect(haceCuanto(hace(49), AHORA)).toBe("hace 2 días");
  });
});
