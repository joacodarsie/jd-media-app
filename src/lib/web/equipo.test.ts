import { describe, expect, it } from "vitest";
import { equipoParaWeb } from "./equipo";

describe("equipoParaWeb", () => {
  it("ordena por rol, usa el área que más pesa y deja afuera lo que no es público", () => {
    const out = equipoParaWeb([
      { nombre: "Sol", area: "Community Manager", area_secundaria: null, avatar_url: null },
      { nombre: "Santi", area: "Comercial", area_secundaria: "Coordinación de Diseño", avatar_url: "https://x.supabase.co/storage/v1/object/public/a/s.png" },
      { nombre: "Joaquín", area: "Estrategia/Dirección", area_secundaria: null, avatar_url: null },
      { nombre: "Cuenta técnica", area: "Estrategia/Dirección", area_secundaria: null, avatar_url: null, email: "agenciajdmedia@gmail.com" },
      { nombre: "Prueba", area: "Creativas", area_secundaria: null, avatar_url: null },
    ]);
    expect(out.map((p) => p.nombre)).toEqual(["Joaquín", "Santi", "Sol"]);
    expect(out[1].rol).toBe("Dirección creativa");
    expect(out[1].foto).toContain("/render/image/public/");
    expect(out[2].foto).toBeNull();
  });

  it("en la web va la foto gris, salvo que la persona elija la original", () => {
    const base = { area: "Diseño", area_secundaria: null, avatar_url: "https://x.supabase.co/storage/v1/object/public/a/o.jpg" };
    const gris = "https://x.supabase.co/storage/v1/object/public/a/web-1.webp";
    const [a, b, c] = equipoParaWeb([
      { ...base, nombre: "A", avatar_web_url: gris, foto_web: "gris" },
      { ...base, nombre: "B", avatar_web_url: gris, foto_web: "original" },
      { ...base, nombre: "C", avatar_web_url: null, foto_web: "gris" },
    ]);
    expect(a.fotoGrande).toBe(gris);
    expect(b.fotoGrande).toContain("o.jpg");
    expect(c.fotoGrande).toContain("o.jpg");
  });

  it("las grises de la web usan su versión chica para las caras", () => {
    const [p] = equipoParaWeb([{ nombre: "Luz", area: "Coordinación", area_secundaria: null, avatar_url: null, avatar_web_url: "https://jdmedia.com.ar/images/equipo/gris/luz-torres.webp" }]);
    expect(p.foto).toBe("https://jdmedia.com.ar/images/equipo/gris/sm/luz-torres.webp");
    expect(p.fotoGrande).toBe("https://jdmedia.com.ar/images/equipo/gris/luz-torres.webp");
  });
});
