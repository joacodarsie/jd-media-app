import { describe, it, expect } from "vitest";
import {
  productionBase,
  mbCost,
  packCost,
  mergeSettings,
  serviceDeliveryCost,
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

describe("serviceDeliveryCost", () => {
  const base = {
    tipo: "branding",
    monto_mensual: 400_000,
    costo_override: null,
    costo_pct: null,
    costo_override_user: "u1",
  };
  it("% del monto al que entrega (branding 50% de 400k = 200k)", () => {
    expect(serviceDeliveryCost({ ...base, costo_pct: 0.5 })).toEqual({
      monto: 200_000,
      userId: "u1",
    });
  });
  it("monto fijo tiene prioridad sobre el %", () => {
    expect(serviceDeliveryCost({ ...base, costo_override: 150_000, costo_pct: 0.5 })).toEqual({
      monto: 150_000,
      userId: "u1",
    });
  });
  it("gestión de redes y pauta no usan este costo", () => {
    expect(serviceDeliveryCost({ ...base, tipo: "gestion_redes", costo_pct: 0.5 })).toBeNull();
    expect(serviceDeliveryCost({ ...base, tipo: "paid_media", costo_pct: 0.5 })).toBeNull();
  });
  it("sin costo configurado → null", () => {
    expect(serviceDeliveryCost(base)).toBeNull();
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
