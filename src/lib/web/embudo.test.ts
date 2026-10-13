import { describe, expect, it } from "vitest";
import { fuenteDe, resumirWeb, variacion } from "./embudo";

describe("de dónde vino la visita", () => {
  it("manda el utm_source (link de la bio, pauta)", () => {
    expect(fuenteDe("ig", "https://l.instagram.com/")).toBe("Instagram");
    expect(fuenteDe("facebook", null)).toBe("Facebook");
    expect(fuenteDe("gbp", null)).toBe("Google");
    expect(fuenteDe("newsletter", null)).toBe("Otra campaña");
  });
  it("sin utm, el sitio que la mandó", () => {
    expect(fuenteDe(null, "https://www.google.com/")).toBe("Google");
    expect(fuenteDe(null, "https://l.facebook.com/l.php")).toBe("Facebook");
    expect(fuenteDe(null, "https://jdmedia.com.ar/servicios/")).toBe("Directo");
    expect(fuenteDe(null, "")).toBe("Directo");
    expect(fuenteDe(null, "https://algun-blog.com/nota")).toBe("Otro sitio");
    expect(fuenteDe(null, "no es una url")).toBe("Directo");
  });
});

describe("resumen del embudo", () => {
  const e = (tipo: string, fuente: string | null = null) => ({ tipo, fuente, created_at: "2026-10-13T12:00:00Z" });
  it("cuenta cada paso, la tasa y las fuentes ordenadas", () => {
    const r = resumirWeb([
      e("visita", "Instagram"),
      e("visita", "Instagram"),
      e("visita", "Google"),
      e("visita", null),
      e("whatsapp"),
      e("recurso"),
      e("resena"),
    ]);
    expect(r).toMatchObject({ visitas: 4, whatsapp: 1, recursos: 1, resenas: 1, tasa: 25 });
    expect(r.fuentes).toEqual([
      { fuente: "Instagram", visitas: 2 },
      { fuente: "Google", visitas: 1 },
      { fuente: "Directo", visitas: 1 },
    ]);
  });
  it("sin visitas no hay tasa", () => {
    expect(resumirWeb([]).tasa).toBeNull();
  });
  it("variación contra la semana anterior", () => {
    expect(variacion(12, 10)).toBe("▲ 20%");
    expect(variacion(9, 10)).toBe("▼ 10%");
    expect(variacion(10, 10)).toBe("=");
    expect(variacion(3, 0)).toBe("nuevo");
    expect(variacion(0, 0)).toBeNull();
  });
});
