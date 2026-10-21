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
});
