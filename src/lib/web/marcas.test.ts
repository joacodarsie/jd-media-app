import { describe, expect, it } from "vitest";
import { linkInstagram, marcasParaWeb } from "./marcas";

describe("marcas de la web", () => {
  it("el link de Instagram sale del usuario o de la URL cargada", () => {
    expect(linkInstagram("boxescar", null)).toBe("https://www.instagram.com/boxescar/");
    expect(linkInstagram(null, "https://instagram.com/dr_dionisi")).toBe("https://instagram.com/dr_dionisi");
    expect(linkInstagram(null, "@fundanic.arg")).toBe("https://www.instagram.com/fundanic.arg/");
    expect(linkInstagram(null, "https://facebook.com/x")).toBeNull();
    expect(linkInstagram(null, null)).toBeNull();
  });
  it("primero las que tienen logo, después por antigüedad", () => {
    const m = marcasParaWeb([
      { nombre: "Nueva", logo_url: null, ig_username: null, instagram_url: null, fecha_inicio: "2026-10-01" },
      { nombre: "Vieja", logo_url: null, ig_username: null, instagram_url: null, fecha_inicio: "2025-07-01" },
      { nombre: "ConLogo", logo_url: "https://x/l.png", ig_username: "cl", instagram_url: null, fecha_inicio: "2026-09-01" },
    ]);
    expect(m.map((x) => x.nombre)).toEqual(["ConLogo", "Vieja", "Nueva"]);
    expect(m[0].link).toBe("https://www.instagram.com/cl/");
  });
});
