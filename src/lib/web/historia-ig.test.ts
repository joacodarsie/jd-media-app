import { describe, expect, it } from "vitest";
import type { IgMedia } from "@/lib/meta/instagram";
import { armarHistoria, porSemana, primeraLinea } from "./historia-ig";

const m = (id: string, fecha: string, reach: number, tipo = "IMAGE"): IgMedia => ({
  id,
  caption: `Posteo ${id}\n#marketing`,
  media_type: tipo,
  permalink: `https://instagram.com/p/${id}`,
  thumbnail_url: `https://cdn/${id}.jpg`,
  timestamp: `${fecha}T12:00:00+0000`,
  like_count: 10,
  comments_count: 0,
  reach,
  saved: null,
  video_url: tipo === "VIDEO" ? `https://cdn/${id}.mp4` : null,
});

describe("historia de JD Media en Instagram", () => {
  it("los primeros, los más vistos y los últimos, sin repetir", () => {
    const media = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((d, i) => m(`p${i}`, `2025-06-${d}`, i === 5 ? 900 : i === 6 ? 500 : 10, i === 5 ? "VIDEO" : "IMAGE"));
    const h = armarHistoria({ usuario: "jdmedia.digital", seguidores: 4599, publicaciones: 10 }, media, [], 2);
    expect(h.primeros.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(h.recientes.map((p) => p.id)).toEqual(["p9", "p8"]);
    expect(h.destacados.map((p) => p.id)).toEqual(["p5", "p6"]);
    expect(h.destacados[0]).toMatchObject({ tipo: "reel", video: "https://cdn/p5.mp4" });
    expect(h.desde).toBe("2025-06-01");
  });

  it("la primera línea, sin hashtags", () => {
    expect(primeraLinea("#hola\n¡Arrancamos! #jdmedia #cba\nmás texto")).toBe("¡Arrancamos!");
    expect(primeraLinea("a".repeat(200), 20)).toHaveLength(20);
    expect(primeraLinea(null)).toBe("");
  });

  it("la curva va de a una foto por semana, con la última siempre", () => {
    const fotos = ["2026-06-16", "2026-06-17", "2026-06-23", "2026-06-25"].map((fecha, i) => ({ fecha, seguidores: 100 + i }));
    expect(porSemana(fotos).map((f) => f.fecha)).toEqual(["2026-06-16", "2026-06-23", "2026-06-25"]);
  });
});
