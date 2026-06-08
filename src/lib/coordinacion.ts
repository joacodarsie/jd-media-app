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
}

export interface AgencyRates {
  /** Diseño gráfico: por pieza (post/carrusel). */
  diseno_pieza: number;
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
}

export interface AgencySettings {
  packs: PackParam[];
  rates: AgencyRates;
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  packs: [
    { id: "Presencia", precio: 350000, reels: 4, posts: 4, stories: 8 },
    { id: "Crecimiento", precio: 500000, reels: 8, posts: 8, stories: 12 },
    { id: "Escala", precio: 700000, reels: 12, posts: 12, stories: 20 },
  ],
  rates: {
    diseno_pieza: 10000,
    edicion_reel: 17900,
    manual_marca: 50000,
    closer: 0,
    cm: { Presencia: 50000, Crecimiento: 70000, Escala: 100000, Personalizado: 70000 },
    media_buyer: { Presencia: 50000, Crecimiento: 70000, Escala: 100000, Personalizado: 70000 },
  },
};

/**
 * Completa cualquier clave faltante de la config guardada con los defaults.
 * Útil cuando agregamos parámetros nuevos (closer, Personalizado) y la fila
 * vieja todavía no los tiene.
 */
export function mergeSettings(raw: Partial<AgencySettings> | null): AgencySettings {
  const d = DEFAULT_AGENCY_SETTINGS;
  if (!raw) return d;
  return {
    packs: raw.packs?.length ? raw.packs : d.packs,
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
  rates: AgencyRates
): number {
  return (
    (rates.cm[pack] ?? 0) +
    posts * rates.diseno_pieza +
    reels * rates.edicion_reel
  );
}

/** Costo del media buyer para un pack (solo aplica si la cuenta tiene pauta). */
export function mbCost(pack: RatePack, rates: AgencyRates): number {
  return rates.media_buyer[pack] ?? 0;
}

/** Costo de un pack estándar (incluye pauta: escenario de lista full-service). */
export function packCost(pack: PackParam, rates: AgencyRates): number {
  return productionBase(pack.id, pack.posts, pack.reels, rates) + mbCost(pack.id, rates);
}
