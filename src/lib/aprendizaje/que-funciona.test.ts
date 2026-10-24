import { describe, expect, it } from "vitest";
import { enArgentina, formatoDe, paraLaIa, queFunciona, type PostMedido } from "./que-funciona";

// Un post: fecha y hora en UTC como las manda Instagram.
const p = (ts: string, likes: number, tipo = "IMAGE", producto: string | null = "FEED"): PostMedido => ({
  timestamp: `${ts}+0000`,
  likes,
  comentarios: 0,
  tipo,
  producto,
  permalink: `https://instagram.com/p/${ts}`,
  imagen: null,
});

describe("qué funciona en una cuenta", () => {
  it("formato y hora argentina", () => {
    expect(formatoDe({ tipo: "VIDEO", producto: "REELS" })).toBe("Reels");
    expect(formatoDe({ tipo: "CAROUSEL_ALBUM", producto: "FEED" })).toBe("Carruseles");
    expect(formatoDe({ tipo: "IMAGE", producto: "FEED" })).toBe("Fotos");
    // 01:30 UTC del jueves es 22:30 del miércoles en Argentina.
    expect(enArgentina("2026-10-22T01:30:00+0000")).toEqual({ dia: 3, hora: 22, fecha: "2026-10-21" });
  });

  it("con pocas publicaciones no inventa patrones", () => {
    const q = queFunciona([p("2026-10-01T15:00:00", 10), p("2026-10-02T15:00:00", 50)], "2026-10-24");
    expect(q.frases[0]).toContain("pocas publicaciones");
    expect(paraLaIa(q)).toBeNull();
  });

  it("encuentra el formato, el día y el horario que rinden", () => {
    const posts = [
      // Reels los jueves a la noche (23 UTC = 20 h): rinden.
      p("2026-10-01T23:00:00", 90, "VIDEO", "REELS"),
      p("2026-10-08T23:00:00", 100, "VIDEO", "REELS"),
      p("2026-10-15T23:00:00", 110, "VIDEO", "REELS"),
      p("2026-10-22T23:00:00", 300, "VIDEO", "REELS"),
      // Fotos el lunes a la tarde (18 UTC = 15 h): poco.
      p("2026-09-28T18:00:00", 20),
      p("2026-10-05T18:00:00", 25),
      p("2026-10-12T18:00:00", 30),
      p("2026-10-19T18:00:00", 25),
    ];
    const q = queFunciona(posts, "2026-10-24");
    expect(q.posts).toBe(8);
    expect(q.formatos[0]).toMatchObject({ nombre: "Reels", n: 4 });
    expect(q.frases).toEqual([
      "Los reels traen 6 veces más interacción que las fotos.",
      "Los jueves rinden 1,7 veces más que el promedio.",
      "El mejor horario es la noche (19 a 24 h): 1,7 veces el promedio.",
    ]);
    expect(q.top[0]).toMatchObject({ interaccion: 300, formato: "Reels", fecha: "2026-10-22" });
    expect(paraLaIa(q)).toContain("Los reels traen 6 veces más");
  });

  it("sin diferencias claras, lo dice", () => {
    const posts = Array.from({ length: 9 }, (_, i) => p(`2026-10-${String(10 + i).padStart(2, "0")}T15:00:00`, 50 + (i % 2)));
    expect(queFunciona(posts, "2026-10-24").frases).toEqual([
      "Todavía no hay un patrón claro: ningún formato, día ni horario se despega. Conviene seguir variando para descubrirlo.",
    ]);
  });

  it("ignora lo viejo y lo que no muestra me gusta", () => {
    const posts = [p("2025-01-01T15:00:00", 999), { ...p("2026-10-20T15:00:00", 0), likes: null }];
    expect(queFunciona(posts, "2026-10-24").posts).toBe(0);
  });
});
