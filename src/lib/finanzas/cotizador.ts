import type { AgencyRates, RatePack } from "@/lib/coordinacion";

/**
 * Cuánto cuesta armar una propuesta a medida, componente por componente.
 *
 * Por qué existe: los packs de lista ya se costean en Coordinación, pero desde
 * que se cotiza a medida (Warrior, S&C, Zoomiemania) el precio se estaba
 * poniendo a ojo. El dueño lo dijo así: "que me diga cuánto me cuesta a mí,
 * como dueño, esta parte". Sin eso, una cotización personalizada puede quedar
 * por debajo del costo y nadie se entera hasta fin de mes.
 *
 * Dos números que la pantalla de rentabilidad no daba:
 *  - El costo de UNA combinación cualquiera, sin que exista el cliente todavía.
 *  - El precio que hay que cobrar para llegar a un margen objetivo.
 *
 * Puro y testeado: no toca la base ni depende de React.
 */

export interface ItemsCotizacion {
  /** Reels editados en el mes. */
  reels: number;
  /** Placas, posts o carruseles en el mes. */
  piezas: number;
  /** Portadas de reel. Por defecto, una por reel. */
  portadas?: number;
  /** Pack que define la tarifa mensual del CM. `null` = sin CM asignada. */
  cm: RatePack | null;
  /** Pack que define la tarifa del media buyer. `null` = la cuenta no lleva pauta. */
  mediaBuyer: RatePack | null;
  /** Manual de marca: solo el primer mes. */
  manualMarca: boolean;
  /** Costo extra que se carga a mano (un freelance puntual, una licencia). */
  otros: number;
}

export interface LineaCosto {
  concepto: string;
  detalle: string;
  monto: number;
  /** true = se paga una sola vez, en el arranque. */
  unaVez: boolean;
}

export interface CostoCotizacion {
  lineas: LineaCosto[];
  /** Lo que cuesta todos los meses, sin contar la comisión de coordinación. */
  recurrenteSinCoord: number;
  /** Lo que se paga una sola vez al arrancar (manual de marca, etc.). */
  unaVez: number;
}

export const ITEMS_VACIOS: ItemsCotizacion = {
  reels: 0,
  piezas: 0,
  cm: null,
  mediaBuyer: null,
  manualMarca: false,
  otros: 0,
};

/** El desglose del costo, línea por línea, como se muestra en pantalla. */
export function costoDeItems(items: ItemsCotizacion, rates: AgencyRates): CostoCotizacion {
  const lineas: LineaCosto[] = [];
  const portadas = items.portadas ?? items.reels;

  if (items.cm) {
    const monto = rates.cm[items.cm] ?? 0;
    if (monto > 0)
      lineas.push({
        concepto: "Community manager",
        detalle: `Tarifa ${items.cm} · incluye las historias`,
        monto,
        unaVez: false,
      });
  }
  if (items.reels > 0) {
    lineas.push({
      concepto: "Edición de reels",
      detalle: `${items.reels} × $${rates.edicion_reel.toLocaleString("es-AR")}`,
      monto: items.reels * rates.edicion_reel,
      unaVez: false,
    });
  }
  if (portadas > 0 && (rates.portada_reel ?? 0) > 0) {
    lineas.push({
      concepto: "Portadas de reel",
      detalle: `${portadas} × $${(rates.portada_reel ?? 0).toLocaleString("es-AR")}`,
      monto: portadas * (rates.portada_reel ?? 0),
      unaVez: false,
    });
  }
  if (items.piezas > 0) {
    lineas.push({
      concepto: "Diseño de piezas",
      detalle: `${items.piezas} × $${rates.diseno_pieza.toLocaleString("es-AR")}`,
      monto: items.piezas * rates.diseno_pieza,
      unaVez: false,
    });
  }
  if (items.mediaBuyer) {
    const monto = rates.media_buyer[items.mediaBuyer] ?? 0;
    if (monto > 0)
      lineas.push({
        concepto: "Media buyer",
        detalle: `Tarifa ${items.mediaBuyer} · gestión de campañas`,
        monto,
        unaVez: false,
      });
  }
  if (items.otros > 0) {
    lineas.push({ concepto: "Otros costos", detalle: "Cargado a mano", monto: items.otros, unaVez: false });
  }
  if (items.manualMarca && rates.manual_marca > 0) {
    lineas.push({
      concepto: "Manual de marca",
      detalle: "Solo el primer mes",
      monto: rates.manual_marca,
      unaVez: true,
    });
  }

  const recurrenteSinCoord = lineas.filter((l) => !l.unaVez).reduce((a, l) => a + l.monto, 0);
  const unaVez = lineas.filter((l) => l.unaVez).reduce((a, l) => a + l.monto, 0);
  return { lineas, recurrenteSinCoord, unaVez };
}

export interface ResultadoPrecio {
  /** Costo del equipo más la comisión de coordinación, que depende del precio. */
  costoMensual: number;
  /** La comisión de coordinación, que se calcula sobre el precio y no sobre el costo. */
  coordinacion: number;
  /** Parte de los gastos fijos de la agencia que le toca a esta cuenta. */
  fijosProrrateados: number;
  /** Precio − costo mensual. Todavía no descuenta los fijos. */
  margen: number;
  margenPct: number;
  /** Lo que queda de verdad, después de que la cuenta pague su parte de los fijos. */
  margenNeto: number;
  margenNetoPct: number;
  /** Costos de arranque (manual de marca + comisión de cierre). */
  arranque: number;
  /** Lo que deja el primer mes, con el arranque descontado. */
  margenPrimerMes: number;
}

/**
 * Qué deja un precio dado.
 *
 * La comisión de coordinación es un % del PRECIO, no del costo: por eso subir
 * el precio no sube el margen en la misma proporción, y por eso el cálculo no
 * se puede hacer sumando costos a secas.
 */
export function resultadoDePrecio(
  precio: number,
  costo: CostoCotizacion,
  rates: AgencyRates,
  opts: { fijosProrrateados?: number; conComisionCierre?: boolean; conCoordinacion?: boolean } = {}
): ResultadoPrecio {
  const p = Math.max(precio, 0);
  const coordinacion = opts.conCoordinacion === false
    ? 0
    : Math.round(p * (rates.comision_coordinacion ?? 0));
  const costoMensual = costo.recurrenteSinCoord + coordinacion;
  const margen = p - costoMensual;
  const fijosProrrateados = Math.max(opts.fijosProrrateados ?? 0, 0);
  const margenNeto = margen - fijosProrrateados;
  const cierre = opts.conComisionCierre === false
    ? 0
    : Math.round(p * (rates.comision_cierre ?? 0));
  const arranque = costo.unaVez + cierre + (rates.plus_primer_mes ?? 0);
  return {
    costoMensual,
    coordinacion,
    fijosProrrateados,
    margen,
    margenPct: p > 0 ? (margen / p) * 100 : 0,
    margenNeto,
    margenNetoPct: p > 0 ? (margenNeto / p) * 100 : 0,
    arranque,
    margenPrimerMes: margen - arranque,
  };
}

/**
 * El precio que hay que cobrar para llegar a un margen objetivo.
 *
 * Se despeja teniendo en cuenta que la coordinación se lleva un % del precio:
 *   precio − (costo + precio·coord) − fijos = precio·objetivo
 *   precio = (costo + fijos) / (1 − coord − objetivo)
 *
 * Devuelve null si el objetivo es inalcanzable (coord + objetivo ≥ 1): no hay
 * precio que lo cumpla, y devolver un número enorme sería mentirle al que cotiza.
 */
export function precioParaMargen(
  costoRecurrente: number,
  objetivoPct: number,
  rates: AgencyRates,
  fijosProrrateados = 0
): number | null {
  const coord = rates.comision_coordinacion ?? 0;
  const objetivo = objetivoPct / 100;
  const divisor = 1 - coord - objetivo;
  if (divisor <= 0.0001) return null;
  const precio = (costoRecurrente + Math.max(fijosProrrateados, 0)) / divisor;
  // Redondeo comercial: a los $5.000 de arriba. Un precio de $372.413 no se cobra.
  return Math.ceil(precio / 5000) * 5000;
}

/**
 * Cuánto de los gastos fijos le toca a cada cuenta.
 *
 * Sin esto el margen miente por lo alto: una cuenta que "deja $59.000" puede
 * estar dejando $5.000 una vez que paga su parte de las plataformas, el
 * monotributo y la cuenta propia de la agencia.
 */
export function prorrateoFijos(totalFijosMensual: number, cuentasActivas: number): number {
  if (cuentasActivas <= 0) return 0;
  return Math.round(Math.max(totalFijosMensual, 0) / cuentasActivas);
}
