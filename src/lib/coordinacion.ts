// Parámetros clave de la agencia que controla el admin desde /coordinacion.

export type PackName = "Presencia" | "Crecimiento" | "Escala";
/** Para las tarifas por pack incluimos Personalizado (cuentas a medida). */
export type RatePack = PackName | "Personalizado";

export interface PackParam {
  id: PackName;
  /** Precio de lista mensual que paga el cliente. */
  precio: number;
  reels: number;
  posts: number;
  /** Días al mes con contenido en stories. */
  stories: number;
  /**
   * Cantidad de portadas de reel del pack (la hace la diseñadora). Por defecto
   * igual a `reels`; se baja si algún reel va sin portada, para costear bien.
   */
  portadas?: number;
}

export interface AgencyRates {
  /** Diseño gráfico: por pieza (post/carrusel). */
  diseno_pieza: number;
  /** Diseño de la portada de cada reel (la hace la diseñadora). */
  portada_reel: number;
  /** Edición audiovisual: por reel. */
  edicion_reel: number;
  /** Manual de marca básico (documento de inicio): pago único. */
  manual_marca: number;
  /** Comisión del closer de venta: se paga una vez, el primer mes del cliente. */
  closer: number;
  /** Community Manager por pack (incluye historias). */
  cm: Record<RatePack, number>;
  /** Media Buyer (gestión de campañas Meta) por pack. */
  media_buyer: Record<RatePack, number>;

  // ── Modelo comercial / comisiones (editable desde Coordinación) ──
  /** Fijo mensual del comercial por sostener la prospección (aparte de las comisiones). */
  comercial_fijo: number;
  /** Cliente nuevo: % del abono el MES 1 (cuando entra el primer pago). */
  comision_cierre: number;
  /**
   * CARTERA: % del abono que cobra CADA MES, desde el mes 2, quien atiende la
   * cuenta (`clients.responsable_id`), mientras el cliente siga y esté al día.
   * Acuerdo del 16/9/2026: 5%. Un solo 5% por cuenta: el residual de los meses
   * 2-4 y los premios por cantidad de cuentas se sacaron ese día.
   */
  comision_cartera: number;
  /** Servicio extra a un cliente ya activo: % de una sola vez sobre lo que pague ese servicio. */
  comision_servicio_extra: number;
  /**
   * @deprecated Se sacó del acuerdo el 14/9/2026 ("el 20% ya es el máximo").
   * Queda por compatibilidad con configs guardadas; no se usa en ningún cálculo.
   */
  comision_lead_propio: number;
  /** % recurrente de la coordinadora de Gestión de Redes sobre el abono de cada cuenta que coordina. */
  comision_coordinacion: number;
  /**
   * % de la COORDINACIÓN GENERAL (Leo, mano derecha) sobre TODO lo que facturan
   * los clientes, de cualquier servicio. Se atribuye a quien tenga el área
   * "Coordinación General".
   */
  comision_coord_general: number;
  /**
   * % de la coordinación de diseño sobre el DISEÑO publicado del mes (post/
   * carrusel + portadas). El plus por aprobar el manual de marca de una cuenta
   * nueva se deriva de este % sobre `manual_marca`. Cuenta interna excluida.
   */
  comision_coord_diseno: number;
  /**
   * DIRECCIÓN CREATIVA (Brisa, desde el 15/9/2026): % del abono de gestión de
   * redes de cada cuenta activa, como la coordinación. Reemplaza a
   * `comision_coord_diseno` desde septiembre de 2026. Arranca en 5%; pasa al 10%
   * cuando se cumplan las condiciones de su acuerdo (se cambia a mano).
   */
  comision_direccion_creativa: number;
  /**
   * Servicio de DISEÑO GRÁFICO STANDALONE (contrato aparte, sin gestión de
   * redes): % del monto que se paga a quien diseña la cuenta (equipo de la
   * cuenta → `clients.disenador_id`). El resto lo cobra la coordinación de
   * diseño (`diseno_standalone_coord_pct`); la agencia se queda el remanente
   * (por defecto 40% + 10% = 50%, agencia 50%).
   */
  diseno_standalone_disenador_pct: number;
  /** % del servicio de diseño standalone que cobra la coordinación de diseño. */
  diseno_standalone_coord_pct: number;

  /**
   * Puesta en marcha: pago único inicial de arranque. DESACTIVADA (0) desde
   * 2026-07: se reemplazó por el modelo de puesta en marcha sin publicación (el primer
   * mes se descuenta una semana de contenido en vez de cobrar un cargo aparte).
   * Se deja el parámetro por si se reactiva; en 0 no se factura.
   */
  puesta_en_marcha: number;
  /**
   * Extra de onboarding para el EQUIPO, solo el primer mes de cada cuenta: % de
   * la tarifa mensual de CM y de Paid Media que se les suma por el laburo
   * exclusivo del arranque (accesos, rediseño de perfiles, setup de pauta).
   * @deprecated Reemplazado por `plus_primer_mes` (monto fijo). Queda por
   * compatibilidad con configs viejas guardadas.
   */
  onboarding_extra_pct: number;
  /**
   * Plus FIJO del primer mes para CM y Paid Media ($ por persona, una vez por
   * cuenta nueva) por las tareas extra del arranque. Modelo FNA 2026-07:
   * $10.000 cada uno ("Plus 1° Mes" $20.000 total en el Excel).
   */
  plus_primer_mes: number;
}

/**
 * Una línea de la lista de precios de referencia: de cuánto se parte para
 * cotizar ese servicio. Desde el 18/9/2026 la web no publica precios (todo se
 * cotiza a medida), así que estos números son internos y cambian seguido: por
 * eso viven en la base y se editan en el Cotizador, no en el código.
 */
export interface PrecioReferencia {
  id: string;
  nombre: string;
  precio: number;
  nota: string;
}

export interface AgencySettings {
  packs: PackParam[];
  rates: AgencyRates;
  preciosReferencia: PrecioReferencia[];
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  packs: [
    { id: "Presencia", precio: 400000, reels: 4, posts: 4, stories: 8, portadas: 4 },
    { id: "Crecimiento", precio: 600000, reels: 8, posts: 8, stories: 12, portadas: 8 },
    { id: "Escala", precio: 800000, reels: 12, posts: 12, stories: 20, portadas: 12 },
  ],
  preciosReferencia: [
    { id: "redes_presencia", nombre: "Gestión de redes · Presencia", precio: 400000, nota: "4 reels · 4 posts · 8 días de historias" },
    { id: "redes_crecimiento", nombre: "Gestión de redes · Crecimiento", precio: 600000, nota: "8 reels · 8 posts · 12 días de historias" },
    { id: "redes_escala", nombre: "Gestión de redes · Escala", precio: 800000, nota: "12 reels · 12 posts · 20 días de historias" },
    { id: "paid_media", nombre: "Gestión de pauta", precio: 100000, nota: "Por mes. La inversión publicitaria va aparte." },
    { id: "gestion_whatsapp", nombre: "Gestión de WhatsApp", precio: 50000, nota: "Imagen de marca, estados, grupos y mensajes a contactos." },
    { id: "google_ads", nombre: "Google Ads y Google Business", precio: 100000, nota: "Campañas de búsqueda y la ficha de Maps. La inversión va aparte." },
    { id: "chatter", nombre: "Chatter", precio: 50000, nota: "Responde y filtra las consultas antes de la venta." },
    { id: "branding", nombre: "Branding / manual de marca", precio: 400000, nota: "Pago único." },
    { id: "desarrollo_web", nombre: "Sitio web", precio: 300000, nota: "Pago único, según el alcance." },
    { id: "jornada", nombre: "Jornada de producción", precio: 50000, nota: "La primera hora; cada hora extra $25.000 + viáticos." },
  ],
  rates: {
    diseno_pieza: 8000,
    portada_reel: 2000,
    edicion_reel: 15000,
    manual_marca: 50000,
    closer: 0,
    cm: { Presencia: 50000, Crecimiento: 70000, Escala: 90000, Personalizado: 50000 },
    media_buyer: { Presencia: 50000, Crecimiento: 70000, Escala: 90000, Personalizado: 50000 },
    comercial_fijo: 25000,
    comision_cierre: 0.15,
    comision_cartera: 0.05,
    comision_servicio_extra: 0.15,
    comision_lead_propio: 0,
    comision_coordinacion: 0.1,
    comision_coord_general: 0.05,
    comision_coord_diseno: 0.05,
    comision_direccion_creativa: 0.05,
    diseno_standalone_disenador_pct: 0.4,
    diseno_standalone_coord_pct: 0.1,
    puesta_en_marcha: 0,
    onboarding_extra_pct: 0,
    plus_primer_mes: 0,
  },
};

/**
 * Completa cualquier clave faltante de la config guardada con los defaults.
 * Útil cuando agregamos parámetros nuevos (closer, Personalizado) y la fila
 * vieja todavía no los tiene.
 */
export function mergeSettings(
  // La columna de la base se llama `precios_referencia`; se acepta de las dos
  // formas para no tener que mapearla en cada página que lee settings.
  raw: (Partial<AgencySettings> & { precios_referencia?: PrecioReferencia[] }) | null
): AgencySettings {
  const d = DEFAULT_AGENCY_SETTINGS;
  if (!raw) return d;
  return {
    packs: raw.packs?.length ? raw.packs : d.packs,
    preciosReferencia:
      raw.preciosReferencia?.length
        ? raw.preciosReferencia
        : raw.precios_referencia?.length
        ? raw.precios_referencia
        : d.preciosReferencia,
    rates: {
      ...d.rates,
      ...(raw.rates ?? {}),
      cm: { ...d.rates.cm, ...(raw.rates?.cm ?? {}) },
      media_buyer: { ...d.rates.media_buyer, ...(raw.rates?.media_buyer ?? {}) },
    },
  };
}

/**
 * Costo del equipo creativo (CM + diseño + edición), sin la pauta.
 * Las historias las hace la CM (incluidas en su tarifa). El manual de marca y la
 * comisión del closer NO entran acá (son one-time del primer mes).
 */
export function productionBase(
  pack: RatePack,
  posts: number,
  reels: number,
  rates: AgencyRates,
  /** Portadas de reel a costear. Por defecto, una por reel. */
  portadas: number = reels
): number {
  return (
    (rates.cm[pack] ?? 0) +
    posts * rates.diseno_pieza +
    reels * rates.edicion_reel +
    portadas * (rates.portada_reel ?? 0)
  );
}

/** Costo del media buyer para un pack (solo aplica si la cuenta tiene pauta). */
export function mbCost(pack: RatePack, rates: AgencyRates): number {
  return rates.media_buyer[pack] ?? 0;
}

/** Servicio para resolver su costo de entrega (campos relevantes). */
export interface ServiceCostInput {
  tipo: string;
  monto_mensual: number | null;
  costo_override: number | null;
  costo_pct: number | null;
  costo_override_user: string | null;
}

/**
 * Costo de entrega de un servicio que NO es gestión de redes ni pauta (branding,
 * web, botly…): un monto fijo (`costo_override`) o un % del monto
 * (`costo_pct`), pagado a `costo_override_user`. Devuelve null si no aplica o si
 * no hay costo configurado. La gestión de redes se costea por-pieza aparte, la
 * pauta (media buyer) va incluida en gestión, y el diseño gráfico standalone
 * tiene su propio reparto fijo (ver `standaloneDesignCost` + `computeStandaloneDesignLines`).
 */
export function serviceDeliveryCost(
  svc: ServiceCostInput
): { monto: number; userId: string | null } | null {
  if (svc.tipo === "gestion_redes" || svc.tipo === "paid_media" || svc.tipo === "diseno_grafico")
    return null;
  if (svc.costo_override != null) {
    return { monto: Number(svc.costo_override), userId: svc.costo_override_user };
  }
  if (svc.costo_pct != null) {
    const base = Number(svc.monto_mensual) || 0;
    return { monto: Math.round(base * Number(svc.costo_pct)), userId: svc.costo_override_user };
  }
  return null;
}

/** Servicio de diseño gráfico standalone: campos relevantes para su costo. */
export interface StandaloneDesignCostInput {
  monto_mensual: number | null;
  costo_override: number | null;
}

/**
 * Costo TOTAL (agencia) del servicio de diseño gráfico standalone: un acuerdo
 * fijo (`costo_override`) o el % combinado de diseñador + coordinación de
 * diseño sobre el monto. Para el reparto persona por persona, ver
 * `computeStandaloneDesignLines` (payroll.ts).
 */
export function standaloneDesignCost(
  svc: StandaloneDesignCostInput,
  rates: AgencyRates
): number {
  if (svc.costo_override != null) return Number(svc.costo_override);
  const monto = Number(svc.monto_mensual) || 0;
  const pct =
    (rates.diseno_standalone_disenador_pct ?? 0) + (rates.diseno_standalone_coord_pct ?? 0);
  return Math.round(monto * pct);
}

/** Costo de un pack estándar (incluye pauta: escenario de lista full-service). */
export function packCost(pack: PackParam, rates: AgencyRates): number {
  return (
    productionBase(pack.id, pack.posts, pack.reels, rates, pack.portadas ?? pack.reels) +
    mbCost(pack.id, rates)
  );
}
