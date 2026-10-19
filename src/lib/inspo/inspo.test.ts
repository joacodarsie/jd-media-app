import { describe, expect, it } from "vitest";
import { conRendimiento, deEstaSemana, formatoDe, formatosQueRinden, lasQueLaRompieron, limpiarFuente, type PiezaInspo } from "./inspo";

describe("banco de inspiración", () => {
  it("el rendimiento se mide contra lo normal de la cuenta", () => {
    const r = conRendimiento([
      { id: "a", like_count: 100, comments_count: 0 },
      { id: "b", like_count: 100, comments_count: 0 },
      { id: "c", like_count: 300, comments_count: 0 },
    ]);
    expect(r.map((x) => x.rendimiento)).toEqual([1, 1, 3]);
  });
  it("formatos", () => {
    expect(formatoDe({ media_type: "VIDEO", media_product_type: "REELS" })).toBe("reel");
    expect(formatoDe({ media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" })).toBe("carrusel");
    expect(formatoDe({ media_type: "IMAGE" })).toBe("foto");
  });
  const p = (id: string, formato: PiezaInspo["formato"], rendimiento: number, publicado_at = "2026-10-01T12:00:00Z"): PiezaInspo => ({
    id,
    cuenta: "x",
    permalink: null,
    caption: null,
    formato,
    publicado_at,
    likes: 0,
    comentarios: 0,
    imagen: null,
    rendimiento,
  });
  it("qué formato rinde más (con al menos 3 piezas)", () => {
    const f = formatosQueRinden([p("1", "reel", 3), p("2", "reel", 2), p("3", "reel", 1), p("4", "foto", 1), p("5", "foto", 1), p("6", "foto", 0.5), p("7", "carrusel", 9)]);
    expect(f).toEqual([
      { formato: "reel", rendimiento: 2, cantidad: 3 },
      { formato: "foto", rendimiento: 0.8, cantidad: 3 },
    ]);
  });
  it("las que la rompieron y las de esta semana", () => {
    const xs = [p("a", "reel", 1.5), p("b", "reel", 4), p("c", "foto", 2, "2026-10-18T12:00:00Z")];
    expect(lasQueLaRompieron(xs).map((x) => x.id)).toEqual(["b", "c"]);
    expect(deEstaSemana(xs, Date.parse("2026-10-19T12:00:00Z")).map((x) => x.id)).toEqual(["c"]);
  });
  it("limpia lo que pega la CM", () => {
    expect(limpiarFuente("cuenta", "https://www.instagram.com/PlaceOK/?hl=es")).toBe("placeok");
    expect(limpiarFuente("cuenta", "@la.azotea_cba")).toBe("la.azotea_cba");
    expect(limpiarFuente("cuenta", "no vale!")).toBeNull();
    expect(limpiarFuente("hashtag", "#Panadería Córdoba")).toBe("panaderíacórdoba");
  });
});
