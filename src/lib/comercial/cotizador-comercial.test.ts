import { describe, it, expect } from "vitest";
import {
  cotizarComercial,
  DESCUENTO_SIN_PAUTA,
  type PackComercial,
  type ServicioComercial,
  type PropuestaComercial,
} from "./cotizador-comercial";

const packs: PackComercial[] = [
  { id: "Presencia", precio: 400000, reels: 4, posts: 4, stories: 8 },
  { id: "Crecimiento", precio: 680000, reels: 8, posts: 8, stories: 12 },
];
const servicios: ServicioComercial[] = [
  { id: "paid_media", nombre: "Gestión de pauta", precio: 100000 },
  { id: "gestion_whatsapp", nombre: "Gestión de WhatsApp", precio: 50000 },
  { id: "branding", nombre: "Branding", precio: 400000 },
  { id: "jornada", nombre: "Jornada de producción", precio: 50000 },
];
const minimos = {
  Presencia: { conPauta: 370000, sinPauta: 320000 },
  Crecimiento: { conPauta: 600000, sinPauta: 550000 },
};

const base: PropuestaComercial = { pack: "Presencia", conPauta: true, servicios: [], horasJornada: 1, descuento: 0 };
const cotizar = (p: Partial<PropuestaComercial> = {}) =>
  cotizarComercial({ propuesta: { ...base, ...p }, packs, servicios, minimos, pctCierre: 0.1, pctCartera: 0.05 });

describe("cotizarComercial", () => {
  it("un pack solo cuesta su precio de lista, con la pauta incluida", () => {
    const r = cotizar();
    expect(r.abonoMensual).toBe(400000);
    expect(r.primerMes).toBe(400000);
    expect(r.mensuales[0].detalle).toContain("incluye gestión de pauta");
  });

  it("sin pauta descuenta $50.000", () => {
    expect(cotizar({ conPauta: false }).abonoMensual).toBe(400000 - DESCUENTO_SIN_PAUTA);
  });

  it("aplica el descuento pedido si entra en el tope", () => {
    const r = cotizar({ descuento: 20000 });
    expect(r.abonoMensual).toBe(380000);
    expect(r.descuentoAplicado).toBe(20000);
    expect(r.descuentoRecortado).toBe(false);
  });

  it("🔑 no deja descontar por debajo del mínimo: recorta y avisa", () => {
    const r = cotizar({ descuento: 80000 });
    expect(r.descuentoMaximo).toBe(30000);
    expect(r.descuentoAplicado).toBe(30000);
    expect(r.abonoMensual).toBe(370000);
    expect(r.descuentoRecortado).toBe(true);
  });

  it("el tope sin pauta se mide contra el mínimo sin pauta", () => {
    expect(cotizar({ conPauta: false }).descuentoMaximo).toBe(30000);
  });

  it("el tope va en múltiplos de $5.000", () => {
    const r = cotizarComercial({
      propuesta: base, packs, servicios, pctCierre: 0.1, pctCartera: 0.05,
      minimos: { Presencia: { conPauta: 362600, sinPauta: 300000 } },
    });
    expect(r.descuentoMaximo).toBe(35000);
  });

  it("un mínimo más alto que el precio no deja descuento negativo", () => {
    const r = cotizarComercial({
      propuesta: { ...base, descuento: 10000 }, packs, servicios, pctCierre: 0.1, pctCartera: 0.05,
      minimos: { Presencia: { conPauta: 450000, sinPauta: 400000 } },
    });
    expect(r.descuentoMaximo).toBe(0);
    expect(r.abonoMensual).toBe(400000);
  });

  it("los servicios mensuales suman al abono y no se descuentan", () => {
    const r = cotizar({ servicios: ["gestion_whatsapp"], descuento: 20000 });
    expect(r.abonoMensual).toBe(400000 - 20000 + 50000);
  });

  it("lo de una sola vez va al primer mes, no al abono", () => {
    const r = cotizar({ servicios: ["branding"] });
    expect(r.abonoMensual).toBe(400000);
    expect(r.pagosUnicos).toBe(400000);
    expect(r.primerMes).toBe(800000);
  });

  it("la jornada cobra la primera hora y $25.000 cada extra", () => {
    const r = cotizar({ servicios: ["jornada"], horasJornada: 3 });
    expect(r.pagosUnicos).toBe(50000 + 2 * 25000);
  });

  it("con pack, la pauta suelta no se cobra dos veces", () => {
    expect(cotizar({ servicios: ["paid_media"] }).abonoMensual).toBe(400000);
  });

  it("sin pack, la pauta suelta sí se cobra y no hay descuento", () => {
    const r = cotizar({ pack: null, servicios: ["paid_media"], descuento: 20000 });
    expect(r.abonoMensual).toBe(100000);
    expect(r.descuentoMaximo).toBeNull();
    expect(r.descuentoAplicado).toBe(0);
  });

  it("la comisión es 10% el mes 1 y 5% por mes, sobre el abono y no sobre lo único", () => {
    const r = cotizar({ servicios: ["branding"], descuento: 20000 });
    expect(r.comision.mes1).toBe(38000);
    expect(r.comision.mensual).toBe(19000);
  });
});
