import { describe, expect, it } from "vitest";
import { comparar, fotosQueFaltan, metricasAFecha, type FotoGuardada, type PostHistorial } from "./foto";

const post = (fecha: string, extra: Partial<PostHistorial> = {}): PostHistorial => ({
  timestamp: `${fecha}T15:00:00+0000`,
  likes: 10,
  comentarios: 2,
  tipo: "IMAGE",
  producto: "FEED",
  permalink: `https://instagram.com/p/${fecha}`,
  imagen: `https://cdn/${fecha}.jpg`,
  ...extra,
});

describe("metricasAFecha", () => {
  it("mira solo lo publicado hasta esa fecha", () => {
    const h = [post("2026-10-10", { likes: 100, tipo: "VIDEO", producto: "REELS" }), post("2026-08-20"), post("2026-08-01"), post("2026-07-01")];
    const m = metricasAFecha(h, "2026-08-25");
    expect(m.posts_mes).toBe(2); // 20/8 y 1/8
    expect(m.reels).toBe(0);
    expect(m.interaccion).toBe(12);
    expect(m.grilla.map((g) => g.fecha)).toEqual(["2026-08-20", "2026-08-01", "2026-07-01"]);
    expect(m.disponibles).toBe(3);
  });

  it("la grilla saltea los videos sin miniatura", () => {
    const m = metricasAFecha([post("2026-10-01", { imagen: null }), post("2026-09-30")], "2026-10-17");
    expect(m.grilla).toHaveLength(1);
  });
});

describe("fotosQueFaltan", () => {
  it("cuenta nueva: la foto de inicio es real y es hoy", () => {
    expect(fotosQueFaltan([], "2026-10-17", "2026-10-15")).toEqual([{ tipo: "inicio", fecha: "2026-10-17", real: true }]);
  });
  it("cuenta vieja: reconstruye el inicio y saca la de hoy", () => {
    expect(fotosQueFaltan([], "2026-10-17", "2026-07-05")).toEqual([
      { tipo: "inicio", fecha: "2026-07-05", real: false },
      { tipo: "mensual", fecha: "2026-10-17", real: true },
    ]);
  });
  it("mensual cada 28 días", () => {
    const ex = [{ tipo: "inicio" as const, fecha: "2026-09-19" }];
    expect(fotosQueFaltan(ex, "2026-10-17", "2026-09-19")).toEqual([{ tipo: "mensual", fecha: "2026-10-17", real: true }]);
    expect(fotosQueFaltan(ex, "2026-10-10", "2026-09-19")).toEqual([]);
  });
});

describe("comparar", () => {
  const base: FotoGuardada = { tipo: "inicio", fecha: "2026-07-05", real: false, seguidores: null, publicaciones: null, posts_mes: 1, reels: 2, interaccion: 20, puntaje: null };
  const hoy: FotoGuardada = { tipo: "mensual", fecha: "2026-10-17", real: true, seguidores: 1154, publicaciones: 80, posts_mes: 12, reels: 7, interaccion: 45, puntaje: 78 };

  it("usa la primera medición de seguidores y no compara puntaje reconstruido", () => {
    const c = comparar(base, hoy, 546);
    expect(c.map((x) => x.clave)).toEqual(["seguidores", "posts_mes", "interaccion", "reels"]);
    expect(c[0].cambio).toBe("+111%");
    expect(c[1].cambio).toBe("×12");
    expect(c[2].cambio).toBe("+125%");
    expect(c[3].cambio).toBe("+5");
    expect(c.every((x) => x.mejoro)).toBe(true);
  });

  it("sin seguidores iniciales no inventa", () => {
    expect(comparar(base, hoy, null).some((x) => x.clave === "seguidores")).toBe(false);
  });
});
