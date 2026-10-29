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

// Tarifas con el plus del primer mes que se pagó hasta septiembre de 2026: los
// tests de arranque prueban el mecanismo, que sigue existiendo aunque hoy valga 0.
const rates = { ...DEFAULT_AGENCY_SETTINGS.rates, plus_primer_mes: 10000 };

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
    // CM 50.000 + edición 60.000 + portadas 8.000 + diseño 32.000 + media buyer 50.000
    expect(c.recurrenteSinCoord).toBe(200_000);
  });

  it("ya no cobra coordinación de diseño (se dejó de pagar en septiembre de 2026)", () => {
    const c = costoDeItems({ ...PRESENCIA, manualMarca: true }, rates);
    expect(c.baseDiseno).toBe(40_000); // queda como dato: 4 piezas + 4 portadas
    expect(c.lineas.some((l) => l.concepto === "Coordinación de diseño")).toBe(false);
    const r = resultadoDePrecio(400_000, c, rates);
    expect(r.arranqueLineas.some((l) => l.concepto === "Coordinación de diseño")).toBe(false);
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
    expect(c.conMediaBuyer).toBe(false);
    expect(c.conCM).toBe(true);
  });
});

describe("resultadoDePrecio", () => {
  const costo = costoDeItems(PRESENCIA, rates);

  it("cobra coordinación, dirección creativa y la cartera del closer, todo sobre el precio", () => {
    const r = resultadoDePrecio(400_000, costo, rates);
    expect(r.coordinacion).toBe(40_000); // 10%
    expect(r.coordGeneral).toBe(0); // Leo no cobra por ahora (24/9/2026)
    expect(r.direccionCreativa).toBe(20_000); // 5%
    expect(r.cartera).toBe(20_000); // 5% del closer, desde el mes 2
    expect(r.costoMensual).toBe(280_000);
    expect(r.margen).toBe(120_000); // 30% en un mes normal
  });

  it("si la cerró el dueño no hay cartera del closer", () => {
    const r = resultadoDePrecio(400_000, costo, rates, { conComisionCierre: false });
    expect(r.cartera).toBe(0);
    expect(r.margen).toBe(140_000);
  });

  it("descuenta los fijos para mostrar lo que queda de verdad", () => {
    const r = resultadoDePrecio(400_000, costo, rates, { fijosProrrateados: 54_000 });
    expect(r.margenNeto).toBe(66_000);
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
    // La dirección creativa y el closer se pagan igual.
    expect(r.costoMensual).toBe(240_000);
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
    // manual 50.000 + comisión del comercial 40.000 (10% desde octubre de 2026) + plus 20.000
    expect(r.arranque).toBe(110_000);
    // El mes 1 no paga la cartera del closer (cobra el cierre): 120.000 + 20.000 − 110.000.
    expect(r.margenPrimerMes).toBe(30_000);
  });

  it("la dirección creativa se paga desde el mes 1; la cartera del closer, recién desde el 2", () => {
    const r = resultadoDePrecio(400_000, conManual, rates);
    const costoMes1 = r.costoMensual - r.cartera;
    expect(costoMes1).toBe(260_000); // incluye los 20.000 de dirección creativa
    expect(400_000 - costoMes1 - r.arranque).toBe(r.margenPrimerMes);
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

  it("🔴 la cartera del closer se lleva 5 puntos de margen todos los meses", () => {
    // Por eso el precio para un mismo margen sube cuando la cerró un comercial.
    const conComercial = precioParaMargen(conManual.recurrenteSinCoord, 40, rates)!;
    const sinComercial = precioParaMargen(conManual.recurrenteSinCoord, 40, rates, 0, {
      conComisionCierre: false,
    })!;
    expect(conComercial).toBeGreaterThan(sinComercial);
    expect(resultadoDePrecio(conComercial, conManual, rates).margenPct).toBeGreaterThanOrEqual(40);
    expect(
      resultadoDePrecio(sinComercial, conManual, rates, { conComisionCierre: false }).margenPct
    ).toBeGreaterThanOrEqual(40);
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

describe("los packs de lista con las comisiones de octubre de 2026", () => {
  // Tarifas reales cargadas en Coordinación al 29/10/2026.
  const reales = {
    ...DEFAULT_AGENCY_SETTINGS.rates,
    plus_primer_mes: 0,
    cm: { Presencia: 50_000, Crecimiento: 70_000, Escala: 90_000, Personalizado: 50_000 },
    media_buyer: { Presencia: 50_000, Crecimiento: 70_000, Escala: 90_000, Personalizado: 50_000 },
    edicion_reel: 15_000,
    portada_reel: 2_000,
    diseno_pieza: 8_000,
    comision_coordinacion: 0.1,
    comision_coord_general: 0,
    comision_direccion_creativa: 0.05,
    comision_cartera: 0.05,
  };
  const pack = (id: "Presencia" | "Crecimiento" | "Escala", n: number) =>
    costoDeItems({ ...ITEMS_VACIOS, reels: n, piezas: n, cm: id, mediaBuyer: id }, reales);

  it("cuánto deja cada pack a su precio de lista, en un mes normal", () => {
    expect(pack("Presencia", 4).recurrenteSinCoord).toBe(200_000);
    expect(pack("Crecimiento", 8).recurrenteSinCoord).toBe(340_000);
    expect(pack("Escala", 12).recurrenteSinCoord).toBe(480_000);
    expect(resultadoDePrecio(400_000, pack("Presencia", 4), reales).margen).toBe(120_000); // 30%
    expect(resultadoDePrecio(600_000, pack("Crecimiento", 8), reales).margen).toBe(140_000); // 23%
    expect(resultadoDePrecio(800_000, pack("Escala", 12), reales).margen).toBe(160_000); // 20%
  });

  it("con dirección creativa al 10%, cada pack deja 5 puntos menos", () => {
    const dc10 = { ...reales, comision_direccion_creativa: 0.1 };
    expect(resultadoDePrecio(400_000, pack("Presencia", 4), dc10).margen).toBe(100_000); // 25%
    expect(resultadoDePrecio(600_000, pack("Crecimiento", 8), dc10).margen).toBe(110_000); // 18%
    expect(resultadoDePrecio(800_000, pack("Escala", 12), dc10).margen).toBe(120_000); // 15%
  });

  it("subir la dirección creativa al 10% y sacar el 5% del closer deja el mismo margen", () => {
    const hoy = resultadoDePrecio(500_000, pack("Presencia", 4), reales);
    const cambio = resultadoDePrecio(500_000, pack("Presencia", 4), {
      ...reales,
      comision_direccion_creativa: 0.1,
      comision_cartera: 0,
    });
    expect(cambio.margen).toBe(hoy.margen);
  });

  it("el precio de cada pack para dejar 40% en un mes normal", () => {
    expect(precioParaMargen(200_000, 40, reales)).toBe(500_000);
    expect(precioParaMargen(340_000, 40, reales)).toBe(850_000);
    expect(precioParaMargen(480_000, 40, reales)).toBe(1_200_000);
  });
});
