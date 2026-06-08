// Parámetros clave de la agencia que controla el admin desde /coordinacion.

export type PackName = "Presencia" | "Crecimiento" | "Escala";

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
  /** Community Manager por pack (incluye historias). */
  cm: Record<PackName, number>;
  /** Media Buyer (gestión de campañas Meta) por pack. */
  media_buyer: Record<PackName, number>;
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
    cm: { Presencia: 50000, Crecimiento: 70000, Escala: 100000 },
    media_buyer: { Presencia: 50000, Crecimiento: 70000, Escala: 100000 },
  },
};

/**
 * Costo de producción mensual de un pack: suma de los roles que lo atienden.
 * Las historias las hace la CM (incluidas en su tarifa), por eso no suman aparte.
 * El manual de marca es un pago único, no entra en el costo recurrente del pack.
 */
export function packCost(pack: PackParam, rates: AgencyRates): number {
  return (
    (rates.cm[pack.id] ?? 0) +
    pack.posts * rates.diseno_pieza +
    pack.reels * rates.edicion_reel +
    (rates.media_buyer[pack.id] ?? 0)
  );
}
