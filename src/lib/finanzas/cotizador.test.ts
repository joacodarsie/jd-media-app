import { describe, it, expect } from "vitest";
import { DEFAULT_AGENCY_SETTINGS } from "@/lib/coordinacion";
import {
  costoDeItems,
  resultadoDePrecio,
  precioParaMargen,
  prorrateoFijos,
  ITEMS_VACIOS,
} from "./cotizador";

const rates = DEFAULT_AGENCY_SETTINGS.rates;

describe("costoDeItems", () => {
  it("sin nada cargado, no cuesta nada", () => {
    const c = costoDeItems(ITEMS_VACIOS, rates);
    expect(c.recurrenteSinCoord).toBe(0);
    expect(c.unaVez).toBe(0);
    expect(c.lineas).toHaveLength(0);
  });

  it("reproduce el Pack Presencia de lista", () => {
    // 4 reels + 4 piezas + CM y media buyer de Presencia.
    const c = costoDeItems(
      { ...ITEMS_VACIOS, reels: 4, piezas: 4, cm: "Presencia", mediaBuyer: "Presencia" },
      rates
    );
    // CM 50.000 + edición 60.000 + portadas 8.000 + diseño 32.000 + media buyer 50.000
    expect(c.recurrenteSinCoord).toBe(200_000);
  });

  it("el manual de marca no ensucia el costo mensual", () => {
    const c = costoDeItems({ ...ITEMS_VACIOS, reels: 1, manualMarca: true }, rates);
    expect(c.unaVez).toBe(rates.manual_marca);
    expect(c.recurrenteSinCoord).toBe(rates.edicion_reel + (rates.portada_reel ?? 0));
  });

  it("las portadas se pueden desacoplar de los reels", () => {
    const sinPortadas = costoDeItems({ ...ITEMS_VACIOS, reels: 4, portadas: 0 }, rates);
    expect(sinPortadas.recurrenteSinCoord).toBe(4 * rates.edicion_reel);
  });

  it("una cuenta sin pauta no paga media buyer", () => {
    const c = costoDeItems({ ...ITEMS_VACIOS, cm: "Presencia", mediaBuyer: null }, rates);
    expect(c.recurrenteSinCoord).toBe(rates.cm.Presencia);
  });
});

describe("resultadoDePrecio", () => {
  const costo = costoDeItems(
    { ...ITEMS_VACIOS, reels: 4, piezas: 4, cm: "Presencia", mediaBuyer: "Presencia" },
    rates
  );

  it("da el mismo margen que el pack de lista", () => {
    const r = resultadoDePrecio(400_000, costo, rates);
    // 200.000 de equipo + 40.000 de coordinación = 240.000
    expect(r.costoMensual).toBe(240_000);
    expect(r.margen).toBe(160_000);
    expect(Math.round(r.margenPct)).toBe(40);
  });

  it("descuenta los fijos para mostrar lo que queda de verdad", () => {
    const r = resultadoDePrecio(400_000, costo, rates, { fijosProrrateados: 54_000 });
    expect(r.margenNeto).toBe(106_000);
  });

  it("el primer mes deja mucho menos por el arranque", () => {
    const conManual = costoDeItems(
      { ...ITEMS_VACIOS, reels: 4, piezas: 4, cm: "Presencia", mediaBuyer: "Presencia", manualMarca: true },
      rates
    );
    const r = resultadoDePrecio(400_000, conManual, rates);
    // arranque = manual 50.000 + cierre 40.000 + plus 10.000
    expect(r.arranque).toBe(100_000);
    expect(r.margenPrimerMes).toBe(60_000);
  });

  it("un precio por debajo del costo da margen negativo, no cero", () => {
    const r = resultadoDePrecio(150_000, costo, rates);
    expect(r.margen).toBeLessThan(0);
  });

  it("sin coordinación asignada, esa comisión no se cobra", () => {
    const r = resultadoDePrecio(400_000, costo, rates, { conCoordinacion: false });
    expect(r.coordinacion).toBe(0);
    expect(r.costoMensual).toBe(200_000);
  });
});

describe("precioParaMargen", () => {
  it("el precio que devuelve cumple el margen pedido", () => {
    const costo = 200_000;
    const precio = precioParaMargen(costo, 40, rates)!;
    const c = { lineas: [], recurrenteSinCoord: costo, unaVez: 0 };
    const r = resultadoDePrecio(precio, c, rates);
    // Redondea a los $5.000 de arriba, así que el margen real es ≥ el pedido.
    expect(r.margenPct).toBeGreaterThanOrEqual(40);
    expect(r.margenPct).toBeLessThan(42);
  });

  it("tiene en cuenta los fijos cuando se le piden", () => {
    const conFijos = precioParaMargen(200_000, 40, rates, 54_000)!;
    const sinFijos = precioParaMargen(200_000, 40, rates)!;
    expect(conFijos).toBeGreaterThan(sinFijos);
  });

  it("redondea a los $5.000 de arriba", () => {
    const precio = precioParaMargen(123_456, 35, rates)!;
    expect(precio % 5000).toBe(0);
  });

  it("un margen imposible devuelve null en vez de un número absurdo", () => {
    // 90% de margen + 10% de coordinación no deja nada para el costo.
    expect(precioParaMargen(200_000, 90, rates)).toBeNull();
    expect(precioParaMargen(200_000, 120, rates)).toBeNull();
  });
});

describe("prorrateoFijos", () => {
  it("reparte los fijos entre las cuentas activas", () => {
    expect(prorrateoFijos(650_000, 12)).toBe(54_167);
  });

  it("sin cuentas activas no divide por cero", () => {
    expect(prorrateoFijos(650_000, 0)).toBe(0);
  });
});
