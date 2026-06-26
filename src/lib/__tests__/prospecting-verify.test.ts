import { describe, it, expect } from "vitest";
import { toHandle } from "@/lib/prospecting/verify";

describe("toHandle — normaliza handles/URLs de Instagram", () => {
  it("pela el @ y baja a minúsculas", () => {
    expect(toHandle("@Panaderia.Central")).toBe("panaderia.central");
  });

  it("extrae el handle de una URL de instagram", () => {
    expect(toHandle("https://www.instagram.com/nasa/")).toBe("nasa");
    expect(toHandle("instagram.com/Cristiano?hl=es")).toBe("cristiano");
  });

  it("ignora rutas que no son perfiles (p, reel, explore)", () => {
    expect(toHandle("https://instagram.com/p/Cabc123/")).toBeNull();
    expect(toHandle("instagram.com/reel/xyz")).toBeNull();
  });

  it("devuelve null para vacío/null", () => {
    expect(toHandle(null)).toBeNull();
    expect(toHandle("")).toBeNull();
    expect(toHandle("   ")).toBeNull();
    expect(toHandle("@")).toBeNull();
  });

  it("limpia espacios y barra final", () => {
    expect(toHandle("  @marca_ok/  ")).toBe("marca_ok");
  });
});
