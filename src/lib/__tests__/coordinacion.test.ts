import { describe, it, expect } from "vitest";
import {
  productionBase,
  mbCost,
  packCost,
  mergeSettings,
  DEFAULT_AGENCY_SETTINGS,
} from "@/lib/coordinacion";

const r = DEFAULT_AGENCY_SETTINGS.rates;

describe("productionBase", () => {
  it("suma CM del pack + diseño por post + edición y portada por reel", () => {
    // Presencia: cm 50000, diseño 10000/post, edición 17900/reel, portada 2000/reel.
    expect(productionBase("Presencia", 4, 4, r)).toBe(
      50_000 + 4 * 10_000 + 4 * (17_900 + 2_000)
    );
  });
  it("sin piezas, queda solo el CM del pack", () => {
    expect(productionBase("Presencia", 0, 0, r)).toBe(50_000);
  });
});

describe("mbCost", () => {
  it("toma la tarifa de media buyer por pack", () => {
    expect(mbCost("Presencia", r)).toBe(50_000);
    expect(mbCost("Escala", r)).toBe(100_000);
  });
});

describe("packCost", () => {
  it("es producción (con cuota del pack) + media buyer", () => {
    const presencia = DEFAULT_AGENCY_SETTINGS.packs.find((p) => p.id === "Presencia")!;
    const esperado =
      productionBase("Presencia", presencia.posts, presencia.reels, r) + mbCost("Presencia", r);
    expect(packCost(presencia, r)).toBe(esperado);
  });
});

describe("mergeSettings", () => {
  it("null devuelve los defaults", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_AGENCY_SETTINGS);
  });
  it("pisa solo lo provisto y completa el resto con defaults", () => {
    const merged = mergeSettings({ rates: { diseno_pieza: 12_000 } as never });
    expect(merged.rates.diseno_pieza).toBe(12_000); // override
    expect(merged.rates.edicion_reel).toBe(r.edicion_reel); // default
    expect(merged.rates.cm.Presencia).toBe(r.cm.Presencia); // default anidado
  });
});
