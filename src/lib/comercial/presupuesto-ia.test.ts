import { describe, it, expect } from "vitest";
import { DEFAULT_AGENCY_SETTINGS, type AgencyRates, type PackParam } from "@/lib/coordinacion";
import {
  comisionVendedor,
  cuentaDeArmado,
  ejemplosMedida,
  extrasDeIa,
  precioMinimoMedida,
  resolverArmado,
  tarifaParaVolumen,
} from "./presupuesto-ia";

// Las tarifas reales del 30/10/2026 (agency_settings id=1).
const rates: AgencyRates = {
  ...DEFAULT_AGENCY_SETTINGS.rates,
  cm: { Presencia: 50000, Crecimiento: 70000, Escala: 90000, Personalizado: 50000 },
  media_buyer: { Presencia: 50000, Crecimiento: 70000, Escala: 90000, Personalizado: 50000 },
  diseno_pieza: 8000,
  edicion_reel: 15000,
  portada_reel: 2000,
  manual_marca: 50000,
  plus_primer_mes: 0,
  puesta_en_marcha: 0,
  comision_cierre: 0.1,
  comision_cartera: 0.05,
  comision_coordinacion: 0.1,
  comision_coord_general: 0,
  comision_direccion_creativa: 0.05,
};

const packs: PackParam[] = [
  { id: "Presencia", precio: 400000, reels: 4, posts: 4, stories: 8 },
  { id: "Crecimiento", precio: 680000, reels: 8, posts: 8, stories: 12 },
  { id: "Escala", precio: 960000, reels: 12, posts: 12, stories: 20 },
];

describe("precioMinimoMedida", () => {
  it("el volumen de Presencia al 30% da el precio de lista de Presencia", () => {
    expect(precioMinimoMedida({ reels: 4, posts: 4, dias_historias: 8, conPauta: true }, rates, packs)).toBe(400000);
  });

  it("Fragancias (2 reels + 2 carruseles) con pauta sale $300.000, no $265.000", () => {
    expect(precioMinimoMedida({ reels: 2, posts: 2, dias_historias: 8, conPauta: true }, rates, packs)).toBe(300000);
  });

  it("sin pauta no paga media buyer y baja", () => {
    expect(precioMinimoMedida({ reels: 2, posts: 2, dias_historias: 8, conPauta: false }, rates, packs)).toBe(200000);
  });

  it("con otro margen objetivo cambia el precio", () => {
    expect(precioMinimoMedida({ reels: 2, posts: 2, dias_historias: 8, conPauta: true }, rates, packs, 40)).toBe(375000);
  });
});

describe("tarifaParaVolumen", () => {
  it("lo que entra en el pack más chico usa la tarifa de Personalizado", () => {
    expect(tarifaParaVolumen({ reels: 2, posts: 2 }, packs)).toBe("Personalizado");
  });
  it("más volumen que Presencia usa la del pack que lo cubre", () => {
    expect(tarifaParaVolumen({ reels: 6, posts: 3 }, packs)).toBe("Crecimiento");
  });
  it("más que todos, la del más grande", () => {
    expect(tarifaParaVolumen({ reels: 20, posts: 1 }, packs)).toBe("Escala");
  });
});

describe("resolverArmado", () => {
  it("un pack de lista va a precio de lista", () => {
    const a = resolverArmado({ tipo: "pack", pack: "crecimiento" }, rates, packs);
    expect(a).toMatchObject({ tipo: "pack", packSlug: "crecimiento", precio: 680000, reels: 8, conPauta: true });
    expect(a.ajustes).toEqual([]);
  });

  it("un pack que no existe cae al más chico y lo avisa", () => {
    const a = resolverArmado({ tipo: "pack", pack: "premium" }, rates, packs);
    expect(a.packSlug).toBe("presencia");
    expect(a.ajustes).toHaveLength(1);
  });

  it("a medida por debajo del mínimo sube al mínimo y lo avisa", () => {
    const a = resolverArmado(
      { tipo: "medida", reels: 2, posts: 2, dias_historias: 8, con_pauta: true, precio_sugerido: 265000 },
      rates,
      packs,
    );
    expect(a).toMatchObject({ tipo: "medida", packSlug: "personalizado", nombre: "A medida", precio: 300000 });
    expect(a.ajustes[0]).toContain("$300.000");
  });

  it("a medida por encima del mínimo respeta lo sugerido, redondeado a $5.000", () => {
    const a = resolverArmado(
      { tipo: "medida", reels: 2, posts: 2, dias_historias: 8, precio_sugerido: 321000 },
      rates,
      packs,
    );
    expect(a.precio).toBe(325000);
    expect(a.ajustes).toEqual([]);
  });

  it("sin precio sugerido va el mínimo", () => {
    const a = resolverArmado({ tipo: "medida", reels: 2, posts: 2, dias_historias: 8, con_pauta: false }, rates, packs);
    expect(a).toMatchObject({ precio: 200000, conPauta: false });
  });

  it("si a medida cuesta lo mismo que un pack con más volumen, va el pack", () => {
    const a = resolverArmado({ tipo: "medida", reels: 4, posts: 3, dias_historias: 8 }, rates, packs);
    // 4 reels + 3 carruseles con pauta da $385.000; Presencia trae más por $400.000:
    // no conviene, se queda a medida.
    expect(a.tipo).toBe("medida");
    const b = resolverArmado({ tipo: "medida", reels: 4, posts: 4, dias_historias: 6, precio_sugerido: 450000 }, rates, packs);
    expect(b).toMatchObject({ tipo: "pack", packSlug: "presencia", precio: 400000 });
    expect(b.ajustes[0]).toContain("Presencia");
  });

  it("recorta volúmenes fuera de rango y nunca deja un pack vacío", () => {
    const a = resolverArmado({ tipo: "medida", reels: -3, posts: "x", dias_historias: 99 }, rates, packs);
    expect(a).toMatchObject({ reels: 1, posts: 0, dias_historias: 20 });
    expect(a.precio).toBeGreaterThan(0);
  });

  it("sin datos cae al pack más chico", () => {
    expect(resolverArmado(null, rates, packs).packSlug).toBe("presencia");
  });
});

describe("cuentaDeArmado", () => {
  it("el de lista guarda solo el slug: el precio sale del catálogo congelado", () => {
    const a = resolverArmado({ tipo: "pack", pack: "presencia" }, rates, packs);
    expect(cuentaDeArmado(a, "@x")).toEqual({ handle: "@x", packSlug: "presencia", nota: null });
  });

  it("el a medida guarda volumen, precio y si va sin pauta", () => {
    const a = resolverArmado({ tipo: "medida", reels: 2, posts: 2, dias_historias: 8, con_pauta: false }, rates, packs);
    expect(cuentaDeArmado(a, "@x")).toEqual({
      handle: "@x",
      packSlug: "personalizado",
      nota: "Sin gestión de pauta.",
      nombre: "A medida",
      precio: 200000,
      reels: 2,
      posts: 2,
      dias_historias: 8,
    });
  });
});

describe("extrasDeIa", () => {
  it("solo los que existen, con el precio sugerido", () => {
    expect(extrasDeIa(["chatter", "seo", 3])).toEqual([{ slug: "chatter", precio: 50000 }]);
    expect(extrasDeIa("chatter")).toEqual([]);
  });
});

describe("ejemplosMedida y comisión", () => {
  it("los ejemplos traen el precio a medida de Fragancias", () => {
    expect(ejemplosMedida(rates, packs)).toContain("2 reels + 2 carruseles + 8 días de historias, con gestión de pauta: desde $300.000/mes");
  });

  it("comisión del que cierra: 10% el mes 1 y 5% por mes", () => {
    expect(comisionVendedor(300000, rates)).toEqual({ mes1: 30000, mensual: 15000 });
  });
});
