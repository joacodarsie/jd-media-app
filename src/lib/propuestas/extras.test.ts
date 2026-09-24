import { describe, it, expect } from "vitest";
import { armarExtras, normalizarExtras } from "./extras";

describe("extras de la propuesta", () => {
  it("solo acepta extras que existen, una vez cada uno", () => {
    expect(
      normalizarExtras([
        { slug: "gestion_whatsapp", precio: 100000 },
        { slug: "seo", precio: 1 },
        { slug: "gestion_whatsapp", precio: 5 },
      ])
    ).toEqual([{ slug: "gestion_whatsapp", precio: 100000 }]);
    expect(normalizarExtras(null)).toEqual([]);
  });

  it("sin precio usa el sugerido", () => {
    expect(normalizarExtras([{ slug: "google_ads" }])).toEqual([{ slug: "google_ads", precio: 100000 }]);
  });

  it("suma los extras (Truvari: Presencia + WhatsApp a $100.000)", () => {
    const r = armarExtras([{ slug: "gestion_whatsapp", precio: 100000 }]);
    expect(r.total).toBe(100000);
    expect(r.lineas[0].nombre).toBe("Gestión de WhatsApp");
    expect(r.lineas[0].items.length).toBeGreaterThan(0);
  });
});
