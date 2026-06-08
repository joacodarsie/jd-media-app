// Calculador de nómina por persona. Deriva del MISMO modelo de tarifas que el
// panorama de Coordinación, atribuyendo cada componente del costo de producción
// a la persona asignada en la cuenta:
//   - CM por pack         → clients.cm_id
//   - Diseño por pieza    → clients.disenador_id
//   - Edición por reel    → clients.audiovisual_id
//   - Media buyer por pack→ paid_media.media_buyer_user_id (toggle media_buyer_aplica)
//   - Acuerdo fijo (override) → client_services.costo_override_user (monto completo)
// El total de la nómina auto debe coincidir con el costo del panorama.

import {
  mbCost,
  productionBase,
  type AgencyRates,
  type RatePack,
} from "./coordinacion";

export type PayrollLineKind =
  | "cm"
  | "diseno"
  | "edicion"
  | "media_buyer"
  | "override"
  | "comision"
  | "extra"
  | "ajuste";

export interface PayrollLine {
  clienteId: string | null;
  cliente: string;
  concepto: string;
  monto: number;
  kind: PayrollLineKind;
}

export interface PayrollClient {
  id: string;
  nombre: string;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
}

export interface PayrollService {
  cliente_id: string;
  tipo: string; // gestion_redes | paid_media | branding | ...
  pack: string | null;
  pack_detalle: Record<string, number> | null;
  costo_override: number | null;
  costo_override_user: string | null;
  media_buyer_user_id: string | null;
  media_buyer_aplica: boolean | null;
}

/**
 * Calcula las líneas de nómina automáticas (recurrentes del mes) por persona,
 * a partir de los clientes activos, sus servicios y el modelo de tarifas.
 * Devuelve un mapa userId → líneas. No incluye comisiones ni extras manuales
 * (esos viven en payroll_items).
 */
export function computeAutoPayroll(
  clients: PayrollClient[],
  services: PayrollService[],
  rates: AgencyRates,
  fallbackMediaBuyerId: string | null
): Map<string, PayrollLine[]> {
  const byClient = new Map<string, PayrollService[]>();
  for (const s of services) {
    if (!byClient.has(s.cliente_id)) byClient.set(s.cliente_id, []);
    byClient.get(s.cliente_id)!.push(s);
  }

  const out = new Map<string, PayrollLine[]>();
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };

  for (const c of clients) {
    const svcs = byClient.get(c.id) ?? [];
    const gestion = svcs.find((s) => s.tipo === "gestion_redes");

    if (gestion) {
      const pack = (gestion.pack ?? "Personalizado") as RatePack;
      const pd = gestion.pack_detalle ?? {};
      const posts = Number(pd.posts ?? 0);
      const reels = Number(pd.reels ?? 0);

      if (gestion.costo_override != null) {
        // Acuerdo particular: una sola persona cobra un fijo por toda la gestión.
        add(gestion.costo_override_user, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: "Gestión completa (acuerdo fijo)",
          monto: Number(gestion.costo_override),
          kind: "override",
        });
      } else {
        add(c.cm_id, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: `CM ${pack}`,
          monto: rates.cm[pack] ?? 0,
          kind: "cm",
        });
        if (posts > 0) {
          add(c.disenador_id, {
            clienteId: c.id,
            cliente: c.nombre,
            concepto: `Diseño · ${posts} ${posts === 1 ? "pieza" : "piezas"}`,
            monto: posts * rates.diseno_pieza,
            kind: "diseno",
          });
        }
        if (reels > 0) {
          add(c.audiovisual_id, {
            clienteId: c.id,
            cliente: c.nombre,
            concepto: `Edición · ${reels} ${reels === 1 ? "reel" : "reels"}`,
            monto: reels * rates.edicion_reel,
            kind: "edicion",
          });
        }
      }
    }

    // Media buyer: por cada servicio de pauta activo que aplique.
    const pack = (gestion?.pack ?? "Personalizado") as RatePack;
    for (const s of svcs) {
      if (s.tipo !== "paid_media") continue;
      if (s.media_buyer_aplica === false) continue;
      const who = s.media_buyer_user_id ?? fallbackMediaBuyerId;
      add(who, {
        clienteId: c.id,
        cliente: c.nombre,
        concepto: `Media buyer ${pack}`,
        monto: mbCost(pack, rates),
        kind: "media_buyer",
      });
    }
  }

  return out;
}

// Re-export para comodidad de las páginas que arman el panorama y la nómina.
export { productionBase, mbCost };

/** Etiqueta corta del tipo de ítem manual. */
export function payrollKindLabel(kind: PayrollLineKind): string {
  switch (kind) {
    case "comision":
      return "Comisión";
    case "extra":
      return "Extra";
    case "ajuste":
      return "Ajuste";
    default:
      return "";
  }
}

/** Porcentaje de comisión del closer según su intervención en la venta. */
export const COMMISSION_PCT = {
  ambos: 0.2, // cerró y refirió
  closer: 0.15, // solo cerró
  referido: 0.05, // solo refirió
} as const;
