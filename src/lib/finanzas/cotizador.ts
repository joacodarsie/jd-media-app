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
 * El primer mes se calcula aparte porque cuesta bastante más que los demás:
 * manual de marca, comisión del comercial que la cerró y el plus de arranque
 * que cobran la CM y el media buyer. Todos esos son de una sola vez, y son la
 * razón por la que una cuenta que se va antes del mes 3 deja pérdida.
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
  /**
   * Servicios que se suman a la propuesta (WhatsApp, chatter, web, una jornada…),
   * cada uno con lo que se le cobra al cliente y lo que cuesta hacerlo.
   */
  extras?: ExtraCotizacion[];
}

export interface ExtraCotizacion {
  id: string;
  nombre: string;
  /** Lo que paga el cliente. */
  precio: number;
  /** Lo que le cuesta a la agencia (a quién se le paga). */
  costo: number;
  /** true = se cobra y se paga una sola vez (web, branding, una jornada). */
  unaVez: boolean;
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
  /** Lo que cuesta todos los meses, sin contar las comisiones que salen del precio. */
  recurrenteSinCoord: number;
  /** Lo que se paga una sola vez al arrancar (manual de marca y los extras de pago único). */
  unaVez: number;
  /** De eso, lo que es el manual de marca. */
  manual: number;
  /** Lo que el cliente paga por mes por los extras (aparte de la gestión). */
  ingresoMensualExtras: number;
  /** Lo que el cliente paga una sola vez por los extras. */
  ingresoUnaVezExtras: number;
  /** Hay CM asignada: cobra el plus del primer mes. */
  conCM: boolean;
  /** Hay media buyer: cobra su propio plus del primer mes. */
  conMediaBuyer: boolean;
  /** Diseño del mes (piezas + portadas). Ya no paga comisión: queda como dato. */
  baseDiseno: number;
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
  const costoPortadas = portadas > 0 ? portadas * (rates.portada_reel ?? 0) : 0;
  if (costoPortadas > 0) {
    lineas.push({
      concepto: "Portadas de reel",
      detalle: `${portadas} × $${(rates.portada_reel ?? 0).toLocaleString("es-AR")}`,
      monto: costoPortadas,
      unaVez: false,
    });
  }
  const costoPiezas = items.piezas > 0 ? items.piezas * rates.diseno_pieza : 0;
  if (costoPiezas > 0) {
    lineas.push({
      concepto: "Diseño de piezas",
      detalle: `${items.piezas} × $${rates.diseno_pieza.toLocaleString("es-AR")}`,
      monto: costoPiezas,
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
    lineas.push({
      concepto: "Otros costos",
      detalle: "Cargado a mano",
      monto: items.otros,
      unaVez: false,
    });
  }

  // La coordinación de diseño (5% del diseño del mes) se dejó de pagar en
  // septiembre de 2026: la reemplazó la dirección creativa, que es un % del
  // PRECIO y por eso se calcula en `resultadoDePrecio`, no acá.
  const baseDiseno = costoPiezas + costoPortadas;

  const manual = items.manualMarca && rates.manual_marca > 0 ? rates.manual_marca : 0;
  if (manual > 0) {
    lineas.push({
      concepto: "Manual de marca",
      detalle: "Solo el primer mes",
      monto: manual,
      unaVez: true,
    });
  }

  let ingresoMensualExtras = 0;
  let ingresoUnaVezExtras = 0;
  for (const x of items.extras ?? []) {
    if (x.unaVez) ingresoUnaVezExtras += Math.max(x.precio, 0);
    else ingresoMensualExtras += Math.max(x.precio, 0);
    if (x.costo > 0)
      lineas.push({
        concepto: x.nombre || "Extra",
        detalle: x.unaVez ? "Pago único" : "Por mes",
        monto: x.costo,
        unaVez: x.unaVez,
      });
  }

  const recurrenteSinCoord = lineas.filter((l) => !l.unaVez).reduce((a, l) => a + l.monto, 0);
  const unaVez = lineas.filter((l) => l.unaVez).reduce((a, l) => a + l.monto, 0);
  return {
    lineas,
    recurrenteSinCoord,
    unaVez,
    manual,
    ingresoMensualExtras,
    ingresoUnaVezExtras,
    conCM: items.cm != null && (rates.cm[items.cm] ?? 0) > 0,
    conMediaBuyer: items.mediaBuyer != null && (rates.media_buyer[items.mediaBuyer] ?? 0) > 0,
    baseDiseno,
  };
}

/** Una línea del arranque: lo que se paga una sola vez, el primer mes. */
export interface LineaArranque {
  concepto: string;
  detalle: string;
  monto: number;
}

export interface ResultadoPrecio {
  /** Lo que paga el cliente por mes: la gestión más los extras mensuales. */
  precioMensual: number;
  /** Costo del equipo más las comisiones que dependen del precio. */
  costoMensual: number;
  /** La comisión de coordinación, que se calcula sobre el precio y no sobre el costo. */
  coordinacion: number;
  /** La comisión de coordinación general, también sobre el precio. */
  coordGeneral: number;
  /** Dirección creativa: % del precio todos los meses, desde el mes 1. */
  direccionCreativa: number;
  /** Lo que cobra el closer desde el mes 2 (cartera), mientras el cliente siga. 0 si la cerró el dueño. */
  cartera: number;
  /** Parte de los gastos fijos de la agencia que le toca a esta cuenta. */
  fijosProrrateados: number;
  /** Precio mensual − costo mensual (un mes normal, del 2 en adelante). Todavía no descuenta los fijos. */
  margen: number;
  margenPct: number;
  /** Lo que queda de verdad, después de que la cuenta pague su parte de los fijos. */
  margenNeto: number;
  margenNetoPct: number;
  /** Los costos de arranque, uno por uno, para que se vea de dónde sale cada peso. */
  arranqueLineas: LineaArranque[];
  /** Total de los costos de arranque. */
  arranque: number;
  /**
   * Lo que deja el primer mes, con el arranque descontado (sin los fijos). Ese
   * mes el closer cobra su comisión de cierre (en el arranque) y no la cartera.
   */
  margenPrimerMes: number;
  /** Lo que deja el primer mes descontando también su parte de los fijos. */
  margenPrimerMesNeto: number;
}

/**
 * Qué deja un precio dado.
 *
 * Las comisiones son un % del PRECIO, no del costo: por eso subir el precio no
 * sube el margen en la misma proporción, y por eso el cálculo no se puede
 * hacer sumando costos a secas. Todos los meses salen del precio:
 *  - coordinación (Luz) y coordinación general;
 *  - dirección creativa, desde el mes 1;
 *  - la cartera del closer, desde el mes 2 (el mes 1 cobra el cierre, que va
 *    en el arranque). Es el acuerdo comercial de octubre de 2026, el mismo que
 *    liquida la nómina en `payroll/comision-comercial.ts`.
 *
 * `precio` es el de la GESTIÓN DE REDES. La coordinación y la dirección
 * creativa se calculan solo sobre eso (como en la nómina); el closer, sobre
 * todo lo que el cliente paga por mes, extras incluidos. Los extras de pago
 * único entran como ingreso del mes 1.
 */
export function resultadoDePrecio(
  precio: number,
  costo: CostoCotizacion,
  rates: AgencyRates,
  opts: {
    fijosProrrateados?: number;
    /** La cerró un comercial y cobra comisión. Por defecto sí. */
    conComisionCierre?: boolean;
    conCoordinacion?: boolean;
    conCoordGeneral?: boolean;
  } = {}
): ResultadoPrecio {
  const p = Math.max(precio, 0);
  const total = p + costo.ingresoMensualExtras;
  const coordinacion =
    opts.conCoordinacion === false ? 0 : Math.round(p * (rates.comision_coordinacion ?? 0));
  const coordGeneral =
    opts.conCoordGeneral === false ? 0 : Math.round(p * (rates.comision_coord_general ?? 0));
  const direccionCreativa = Math.round(p * (rates.comision_direccion_creativa ?? 0));
  const conCierre = opts.conComisionCierre !== false;
  const cartera = conCierre ? Math.round(total * (rates.comision_cartera ?? 0)) : 0;
  const costoMensual = costo.recurrenteSinCoord + coordinacion + coordGeneral + direccionCreativa + cartera;
  const margen = total - costoMensual;
  const fijosProrrateados = Math.max(opts.fijosProrrateados ?? 0, 0);
  const margenNeto = margen - fijosProrrateados;

  const arranqueLineas = lineasDeArranque(total, costo, rates, conCierre);
  const arranque = arranqueLineas.reduce((a, l) => a + l.monto, 0);

  return {
    precioMensual: total,
    costoMensual,
    coordinacion,
    coordGeneral,
    direccionCreativa,
    cartera,
    fijosProrrateados,
    margen,
    margenPct: total > 0 ? (margen / total) * 100 : 0,
    margenNeto,
    margenNetoPct: total > 0 ? (margenNeto / total) * 100 : 0,
    arranqueLineas,
    arranque,
    // El mes 1 no paga la cartera (ese mes el closer cobra el cierre) y suma lo
    // que el cliente paga una sola vez por los extras.
    margenPrimerMes: margen + cartera - arranque + costo.ingresoUnaVezExtras,
    margenPrimerMesNeto: margenNeto + cartera - arranque + costo.ingresoUnaVezExtras,
  };
}

/**
 * Lo que se paga UNA SOLA VEZ, el primer mes de la cuenta.
 *
 * Estaba mal contado: el plus de arranque se sumaba una sola vez cuando en
 * realidad lo cobran la CM y el media buyer por separado ($10.000 cada uno,
 * como ya lo liquida la nómina), y la comisión del comercial se aplicaba
 * siempre, incluso cuando la venta la cerró el dueño y no la paga nadie.
 */
function lineasDeArranque(
  precio: number,
  costo: CostoCotizacion,
  rates: AgencyRates,
  conComisionCierre: boolean
): LineaArranque[] {
  const lineas: LineaArranque[] = [];

  if (costo.manual > 0) {
    lineas.push({
      concepto: "Manual de marca",
      detalle: "Documento de inicio, pago único",
      monto: costo.manual,
    });
  }
  for (const l of costo.lineas) {
    if (l.unaVez && l.concepto !== "Manual de marca") {
      lineas.push({ concepto: l.concepto, detalle: "Pago único", monto: l.monto });
    }
  }

  if (conComisionCierre) {
    const pct = rates.comision_cierre ?? 0;
    const cierre = Math.round(precio * pct);
    if (cierre > 0) {
      lineas.push({
        concepto: "Comisión del comercial",
        detalle: `${Math.round(pct * 100)}% del primer abono mensual`,
        monto: cierre,
      });
    }
  }

  // El plus de arranque lo cobra CADA UNO de los dos: la CM y el media buyer.
  const plus = rates.plus_primer_mes ?? 0;
  if (plus > 0) {
    const quienes: string[] = [];
    if (costo.conCM) quienes.push("a la CM");
    if (costo.conMediaBuyer) quienes.push("al media buyer");
    if (quienes.length > 0) {
      lineas.push({
        concepto: "Plus de arranque",
        detalle: `$${plus.toLocaleString("es-AR")} ${quienes.join(" y ")}`,
        monto: plus * quienes.length,
      });
    }
  }

  return lineas;
}

/**
 * La parte del arranque que NO depende del precio: manual de marca y el plus
 * de la CM y del media buyer. La comisión del comercial queda afuera porque
 * sale del precio.
 */
function arranqueFijo(costo: CostoCotizacion, rates: AgencyRates): number {
  const plus = rates.plus_primer_mes ?? 0;
  const personas = (costo.conCM ? 1 : 0) + (costo.conMediaBuyer ? 1 : 0);
  return costo.unaVez + plus * personas;
}

/** Lo que se llevan todos los meses las comisiones sobre el precio (sin la del closer). */
function pctMensualSobrePrecio(
  rates: AgencyRates,
  opts: { conCoordinacion?: boolean; conCoordGeneral?: boolean } = {}
): number {
  return (
    (opts.conCoordinacion === false ? 0 : (rates.comision_coordinacion ?? 0)) +
    (opts.conCoordGeneral === false ? 0 : (rates.comision_coord_general ?? 0)) +
    (rates.comision_direccion_creativa ?? 0)
  );
}

/**
 * El precio más bajo con el que NO se pierde plata el primer mes.
 *
 * Es el piso real de una cotización: el dueño lo puso así —"partir de la base
 * de que no tengo que perder plata nunca"—. Un margen objetivo del 30% puede
 * sonar razonable y aun así dejar el mes 1 en rojo, porque la comisión del
 * comercial y el manual de marca se pagan enteros ese mes.
 *
 * Se despeja igual que `precioParaMargen`, pero pidiendo que el primer mes dé
 * cero en vez de un margen:
 *   precio − (costo + precio·coms) − (arranqueFijo + precio·cierre) = 0
 *   precio = (costo + arranqueFijo) / (1 − coms − cierre)
 * donde `coms` son las comisiones mensuales sobre el precio (coordinaciones y
 * dirección creativa). La cartera del closer no entra: el mes 1 cobra el cierre.
 *
 * Con extras, lo que se despeja es el precio de la GESTIÓN: los extras
 * mensuales (Em) pagan cierre pero no coordinación, y los de pago único (Eo)
 * entran enteros el mes 1:
 *   precio = (costo + arranqueFijo − Em·(1 − cierre) − Eo) / (1 − coms − cierre)
 */
export function precioSinPerdidaPrimerMes(
  costo: CostoCotizacion,
  rates: AgencyRates,
  opts: {
    conComisionCierre?: boolean;
    conCoordinacion?: boolean;
    conCoordGeneral?: boolean;
  } = {}
): number | null {
  const coord = pctMensualSobrePrecio(rates, opts);
  const cierre = opts.conComisionCierre === false ? 0 : (rates.comision_cierre ?? 0);
  const divisor = 1 - coord - cierre;
  if (divisor <= 0.0001) return null;
  const precio =
    (costo.recurrenteSinCoord +
      arranqueFijo(costo, rates) -
      costo.ingresoMensualExtras * (1 - cierre) -
      costo.ingresoUnaVezExtras) /
    divisor;
  return Math.ceil(Math.max(precio, 0) / 5000) * 5000;
}

/**
 * El precio que hay que cobrar para llegar a un margen objetivo.
 *
 * Es el margen de un mes normal (del 2 en adelante). Se despeja teniendo en
 * cuenta que las comisiones se llevan un % del precio:
 *   precio − (costo + precio·coms) − fijos = precio·objetivo
 *   precio = (costo + fijos) / (1 − coms − objetivo)
 * con `coms` = coordinaciones + dirección creativa + cartera del closer (si la
 * cerró un comercial).
 *
 * Con extras mensuales (Em) se despeja el precio de la gestión, y el margen se
 * mide sobre todo lo que paga el cliente por mes:
 *   gestión·(1 − coms − objetivo) = costo + fijos − Em·(1 − cartera − objetivo)
 *
 * Devuelve null si el objetivo es inalcanzable (coord + objetivo ≥ 1): no hay
 * precio que lo cumpla, y devolver un número enorme sería mentirle al que cotiza.
 */
export function precioParaMargen(
  costoRecurrente: number,
  objetivoPct: number,
  rates: AgencyRates,
  fijosProrrateados = 0,
  opts: { conComisionCierre?: boolean; extrasMensual?: number } = {}
): number | null {
  const cartera = opts.conComisionCierre === false ? 0 : (rates.comision_cartera ?? 0);
  const coord = pctMensualSobrePrecio(rates) + cartera;
  const objetivo = objetivoPct / 100;
  const divisor = 1 - coord - objetivo;
  if (divisor <= 0.0001) return null;
  const extras = Math.max(opts.extrasMensual ?? 0, 0);
  const precio =
    (costoRecurrente + Math.max(fijosProrrateados, 0) - extras * (1 - cartera - objetivo)) / divisor;
  if (precio <= 0) return 0;
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
