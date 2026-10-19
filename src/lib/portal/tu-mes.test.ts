import { describe, expect, it } from "vitest";
import { armarPlacas, hayTuMes, piezaEstrella } from "./tu-mes";

const base = { nombre: "Magic", mesLabel: "septiembre", publicadas: { reels: 3, posts: 5, historias: 0 }, ig: null, estrella: null };

describe("Tu mes", () => {
  it("sin Instagram igual muestra lo publicado", () => {
    const p = armarPlacas(base);
    expect(p.map((x) => x.tipo)).toEqual(["portada", "numero", "cierre"]);
    expect(p[1]).toMatchObject({ valor: 8, sub: "3 reels · 5 posteos" });
    expect(hayTuMes(p)).toBe(true);
  });
  it("con Instagram suma alcance, seguidores y la estrella", () => {
    const p = armarPlacas({
      ...base,
      ig: { seguidoresNuevos: 120, reach: 15000, interactions: 0, followersEnd: 3200 },
      estrella: { caption: "Nuevo local\nvení", permalink: "x", reach: 5000, likes: 300, comentarios: 0 },
    });
    expect(p.map((x) => x.tipo)).toEqual(["portada", "numero", "numero", "numero", "estrella", "cierre"]);
    expect(p[3]).toMatchObject({ prefijo: "+", valor: 120 });
    expect(p[4]).toMatchObject({ caption: "Nuevo local", datos: "5.000 de alcance · 300 me gusta" });
  });
  it("sin nada no hay botón", () => {
    expect(hayTuMes(armarPlacas({ ...base, publicadas: { reels: 0, posts: 0, historias: 0 } }))).toBe(false);
  });
  it("la estrella es la de más alcance", () => {
    const m = [
      { id: "a", reach: 10, like_count: 999, comments_count: 0 },
      { id: "b", reach: 50, like_count: 1, comments_count: 0 },
    ];
    expect(piezaEstrella(m)?.id).toBe("b");
    expect(piezaEstrella([])).toBeNull();
  });
});
