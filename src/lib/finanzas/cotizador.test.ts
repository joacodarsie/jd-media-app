import { describe, it, expect } from "vitest";
import { DEFAULT_AGENCY_SETTINGS } from "@/lib/coordinacion";
import {
  costoDeItems,
  resultadoDePrecio,
  precioParaMargen,
  precioSinPerdidaPrimerMes,
  prorrateoFijos,
  ITEMS_VACIOS,
  type CostoCotizacion,
} from "./cotizador";

const rates = DEFAULT_AGENCY_SETTINGS.rates;

/** Una cuenta Presencia de lista: 4 reels, 4 piezas, CM y pauta. */
const PRESENCIA = {
  ...ITEMS_VACIOS,
  reels: 4,
  piezas: 4,
  cm: "Presencia" as const,
  mediaBuyer: "Presencia" as const,
};

describe("costoDeItems", () => {
  it("sin nada cargado, no cuesta nada", () => {
    const c = costoDeItems(ITEMS_VACIOS, rates);
    expect(c.recurrenteSinCoord).toBe(0);
    expect(c.unaVez).toBe(0);
    expect(c.lineas).toHaveLength(0);
  });

  it("reproduce el Pack Presencia de lista", () => {
    const c = costoDeItems(PRESENCIA, rates);
    // CM 50.000 + edición 60.000 + portadas 8.000 + diseño 32.000 +
    // media buyer 50.000 + coordinación de diseño 2.000
    expect(c.recurrenteSinCoord).toBe(202_000);
  });

  it("la coordinación de diseño cobra sobre el diseño del mes, no sobre el precio", () => {
    const c = costoDeItems(PRESENCIA, rates);
    expect(c.baseDiseno).toBe(40_000); // 4 piezas + 4 portadas
    const linea = c.lineas.find((l) => l.concepto === "Coordinación de diseño");
    expect(linea?.monto).toBe(2_000); // 5% de 40.000
  });

  it("una cuenta sin diseño no paga coordinación de diseño", () => {
    const c = costoDeItems({ ...ITEMS_VACIOS, mediaBuyer: "Presencia" }, rates);
    expect(c.lineas.some((l) => l.concepto === "Coordinación de diseño")).toBe(false);
  });

  it("el manual de marca no ensucia el costo mensual", () => {
    const c = costoDeItems({ ...ITEMS_VACIOS, reels: 1, manualMarca: true }, rates);
    expect(c.unaVez).toBe(rates.manual_marca);
    // Edición + portada + el 5% de coordinación sobre esa portada.
    expect(c.recurrenteSinCoord).toBe(
      rates.edicion_reel + (rates.portada_reel ?? 0) + Math.round((rates.portada_reel ?? 0) * 0.05)
    );
  });

  it("las portadas se pueden desacoplar de los reels", () => {
    const sinPortadas = costoDeItems({ ...ITEMS_VACIOS, reels: 4, portadas: 0 }, rates);
    expect(sinPortadas.recurrenteSinCoord).toBe(4 * rates.edicion_reel);
  });

  it("una cuenta sin pauta no paga media buyer", () => {
    const c = costoDeItems({ ...ITEMS_VACIOS, cm: "Presencia", mediaBuyer: null }, rates);
    expect(c.recurrenteSinCoord).toBe(rates.cm.Presencia);
    expect(c.conMediaBuyer).toBe(false);
    expect(c.conCM).toBe(true);
  });
});

describe("resultadoDePrecio", () => {
  const costo = costoDeItems(PRESENCIA, rates);

  it("cobra las dos coordinaciones, que salen del precio", () => {
    const r = resultadoDePrecio(400_000, costo, rates);
    expect(r.coordinacion).toBe(40_000); // 10%
    expect(r.coordGeneral).toBe(20_000); // 5%
    expect(r.costoMensual).toBe(262_000);
    expect(r.margen).toBe(138_000);
  });

  it("descuenta los fijos para mostrar lo que queda de verdad", () => {
    const r = resultadoDePrecio(400_000, costo, rates, { fijosProrrateados: 54_000 });
    expect(r.margenNeto).toBe(84_000);
  });

  it("un precio por debajo del costo da margen negativo, no cero", () => {
    const r = resultadoDePrecio(150_000, costo, rates);
    expect(r.margen).toBeLessThan(0);
  });

  it("sin coordinación asignada, esas comisiones no se cobran", () => {
    const r = resultadoDePrecio(400_000, costo, rates, {
      conCoordinacion: false,
      conCoordGeneral: false,
    });
    expect(r.coordinacion).toBe(0);
    expect(r.coordGeneral).toBe(0);
    expect(r.costoMensual).toBe(202_000);
  });
});

describe("el arranque: lo que solo se paga el primer mes", () => {
  const conManual = costoDeItems({ ...PRESENCIA, manualMarca: true }, rates);

  it("el plus lo cobran los DOS: la CM y el media buyer", () => {
    const r = resultadoDePrecio(400_000, conManual, rates);
    const plus = r.arranqueLineas.find((l) => l.concepto === "Plus de arranque");
    expect(plus?.monto).toBe(20_000); // $10.000 cada uno, no $10.000 en total
  });

  it("sin media buyer, el plus es solo el de la CM", () => {
    const sinPauta = costoDeItems({ ...PRESENCIA, mediaBuyer: null, manualMarca: true }, rates);
    const r = resultadoDePrecio(400_000, sinPauta, rates);
    const plus = r.arranqueLineas.find((l) => l.concepto === "Plus de arranque");
    expect(plus?.monto).toBe(10_000);
  });

  it("desglosa el arranque completo de una cuenta Presencia", () => {
    const r = resultadoDePrecio(400_000, conManual, rates);
    // manual 50.000 + 5% del manual para coordinación de diseño 2.500 +
    // comisión del comercial 40.000 + plus 20.000
    expect(r.arranque).toBe(112_500);
    expect(r.margenPrimerMes).toBe(25_500);
  });

  it("si la venta la cerró el dueño, no hay comisión que pagar", () => {
    const conComercial = resultadoDePrecio(400_000, conManual, rates);
    const sinComercial = resultadoDePrecio(400_000, conManual, rates, {
      conComisionCierre: false,
    });
    expect(sinComercial.arranque).toBe(conComercial.arranque - 40_000);
    expect(sinComercial.arranqueLineas.some((l) => l.concepto === "Comisión del comercial")).toBe(
      false
    );
  });

  it("con los fijos descontados, el primer mes de una Presencia da PÉRDIDA", () => {
    const r = resultadoDePrecio(400_000, conManual, rates, { fijosProrrateados: 55_293 });
    expect(r.margenPrimerMesNeto).toBeLessThan(0);
  });

  it("una cuenta sin arranque deja lo mismo el primer mes que los demás", () => {
    const soloPauta = costoDeItems({ ...ITEMS_VACIOS, mediaBuyer: "Presencia" }, rates);
    const r = resultadoDePrecio(150_000, soloPauta, rates, { conComisionCierre: false });
    expect(r.arranque).toBe(10_000); // solo el plus del media buyer
    expect(r.margenPrimerMes).toBe(r.margen - 10_000);
  });
});

describe("precioSinPerdidaPrimerMes", () => {
  const conManual = costoDeItems({ ...PRESENCIA, manualMarca: true }, rates);

  it("al precio que devuelve, el primer mes no da pérdida", () => {
    const piso = precioSinPerdidaPrimerMes(conManual, rates)!;
    const r = resultadoDePrecio(piso, conManual, rates);
    expect(r.margenPrimerMes).toBeGreaterThanOrEqual(0);
  });

  it("un peso menos que el piso sí da pérdida", () => {
    const piso = precioSinPerdidaPrimerMes(conManual, rates)!;
    // El piso redondea a los $5.000 de arriba, así que se baja un escalón entero.
    const r = resultadoDePrecio(piso - 5000, conManual, rates);
    expect(r.margenPrimerMes).toBeLessThan(0);
  });

  it("sin comercial el piso es más bajo: no hay comisión que pagar", () => {
    const conComercial = precioSinPerdidaPrimerMes(conManual, rates)!;
    const sinComercial = precioSinPerdidaPrimerMes(conManual, rates, {
      conComisionCierre: false,
    })!;
    expect(sinComercial).toBeLessThan(conComercial);
  });

  it("sin costos de arranque, el piso apenas supera el costo del mes", () => {
    const sinArranque = costoDeItems({ ...ITEMS_VACIOS, cm: "Presencia" }, rates);
    const sinComercial = { conComisionCierre: false };
    const piso = precioSinPerdidaPrimerMes(sinArranque, rates, sinComercial)!;
    const r = resultadoDePrecio(piso, sinArranque, rates, sinComercial);
    // Solo queda el plus de la CM.
    expect(r.margenPrimerMes).toBeGreaterThanOrEqual(0);
    expect(r.margenPrimerMes).toBeLessThan(10_000);
  });

  it("🔴 con la comisión real del 15%, un margen del 30% arranca en pérdida", () => {
    // Es la razón por la que el piso se muestra aparte del margen objetivo: el
    // margen recurrente puede ser razonable y el mes 1 quedar igual en rojo.
    const reales = { ...rates, comision_cierre: 0.15, comision_coord_general: 0 };
    const precio30 = precioParaMargen(conManual.recurrenteSinCoord, 30, reales)!;
    const piso = precioSinPerdidaPrimerMes(conManual, reales)!;
    expect(precio30).toBeLessThan(piso);
    expect(resultadoDePrecio(precio30, conManual, reales).margenPrimerMes).toBeLessThan(0);
  });

  it("si las comisiones se comen el precio entero, no hay piso posible", () => {
    const imposible = { ...rates, comision_cierre: 0.9, comision_coordinacion: 0.2 };
    expect(precioSinPerdidaPrimerMes(conManual, imposible)).toBeNull();
  });
});

describe("precioParaMargen", () => {
  const vacio = (recurrente: number): CostoCotizacion => ({
    lineas: [],
    recurrenteSinCoord: recurrente,
    unaVez: 0,
    conCM: false,
    conMediaBuyer: false,
    baseDiseno: 0,
  });

  it("el precio que devuelve cumple el margen pedido", () => {
    const precio = precioParaMargen(200_000, 40, rates)!;
    const r = resultadoDePrecio(precio, vacio(200_000), rates);
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
    // 90% de margen + 15% de coordinaciones no deja nada para el costo.
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
