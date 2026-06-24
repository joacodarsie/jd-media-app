// Calculador de nómina por persona. Atribuye cada componente del costo de
// producción a la persona asignada en la cuenta:
//   - CM por pack         → clients.cm_id  (incluye historias)
//   - Media buyer por pack→ clients.media_buyer_id (gestor de pauta de la cuenta),
//       con fallback al rol paid_media. La gestión de campañas de Meta va
//       INCLUIDA en el servicio de gestión de redes: toda cuenta con gestión
//       genera el pago de media buyer (no depende de un servicio de pauta aparte).
//   - Acuerdo fijo (override) → client_services.costo_override_user (monto completo)
//
// El DISEÑO y la EDICIÓN ya NO se pagan por el pack contratado sino por el
// contenido REAL producido en el mes (publicaciones aprobadas/publicadas):
// ver `computeContentPayroll`. Así, una cuenta que produjo menos paga menos.
// El CM y el media buyer siguen siendo por pack (servicio mensual fijo).

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

/** Nómina ya ensamblada de una persona para un período (auto + manual). */
export interface PersonPayroll {
  userId: string;
  nombre: string;
  rol: string;
  alias: string | null;
  titular: string | null;
  autoLines: PayrollLine[];
  manualItems: {
    id: string;
    tipo: "comision" | "extra" | "ajuste";
    concepto: string;
    monto: number;
    cliente: string | null;
    clienteId: string | null;
  }[];
  total: number;
  registrado: boolean;
  pagado: boolean;
}

export interface PayrollClient {
  id: string;
  nombre: string;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  coordinador_id: string | null;
  /** Quién cerró la venta (comercial). Dispara la comisión del primer mes. */
  cerrado_por_id: string | null;
  /** Fecha de inicio del cliente: su primer mes es el período de esta fecha. */
  fecha_inicio: string | null;
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
        // CM por pack (incluye historias). Diseño y edición NO se pagan acá:
        // se pagan por contenido real en computeContentPayroll.
        add(c.cm_id, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: `CM ${pack}`,
          monto: rates.cm[pack] ?? 0,
          kind: "cm",
        });
      }
    }

    // Media buyer: la gestión de campañas de Meta (paid media) va incluida en el
    // servicio de gestión de redes. Solo se paga si el servicio lo incluye
    // (media_buyer_aplica). Si el cliente NO contrató paid media, ese costo no se
    // paga y queda como ganancia de la agencia. Default true (compat).
    if (gestion && gestion.media_buyer_aplica !== false) {
      const pack = (gestion.pack ?? "Personalizado") as RatePack;
      add(c.media_buyer_id ?? fallbackMediaBuyerId, {
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

/** Publicación tal cual la necesita el cálculo de nómina por contenido. */
export interface PayrollPublication {
  cliente_id: string;
  tipo: string; // post | reel | carrusel | historia | video | otro
  estado: string; // ... | aprobado | publicado
  fecha_publicacion: string | null;
  /** Editor/a del reel (puede diferir del audiovisual de la cuenta). */
  audiovisual_id: string | null;
}

/** Estados que cuentan como contenido entregado y pagable. */
const CONTENT_PAYABLE_STATES = new Set(["aprobado", "publicado"]);

/**
 * Calcula las líneas de DISEÑO y EDICIÓN por el contenido REAL del mes, en vez
 * de por el pack contratado. Cuenta las publicaciones aprobadas/publicadas cuya
 * `fecha_publicacion` cae en el período:
 *   - post + carrusel → diseño (clients.disenador_id) · diseno_pieza c/u
 *   - reel + video    → edición (publication.audiovisual_id, fallback al de la
 *                       cuenta) · edicion_reel c/u + portada (disenador_id) · portada_reel
 *   - historia / otro → no se pagan aparte (las cubre la CM por pack)
 *
 * Las cuentas con acuerdo fijo (override) se saltean: ese pago cubre toda la
 * gestión. Función pura → testeable sin DB.
 */
export function computeContentPayroll(
  clients: PayrollClient[],
  publications: PayrollPublication[],
  overrideClientIds: Set<string>,
  rates: AgencyRates,
  periodo: string
): Map<string, PayrollLine[]> {
  const clientById = new Map(clients.map((c) => [c.id, c]));

  // Agregadores por cuenta (y por editor en el caso de edición).
  const disenoCount = new Map<string, number>(); // clienteId → piezas (post+carrusel)
  const portadaCount = new Map<string, number>(); // clienteId → reels (portadas)
  const edicionCount = new Map<string, Map<string, number>>(); // clienteId → editorId → reels

  for (const p of publications) {
    if (!CONTENT_PAYABLE_STATES.has(p.estado)) continue;
    if ((p.fecha_publicacion ?? "").slice(0, 7) !== periodo) continue;
    const c = clientById.get(p.cliente_id);
    if (!c) continue; // cuenta inactiva o interna
    if (overrideClientIds.has(p.cliente_id)) continue; // acuerdo fijo cubre todo

    if (p.tipo === "post" || p.tipo === "carrusel") {
      disenoCount.set(p.cliente_id, (disenoCount.get(p.cliente_id) ?? 0) + 1);
    } else if (p.tipo === "reel" || p.tipo === "video") {
      portadaCount.set(p.cliente_id, (portadaCount.get(p.cliente_id) ?? 0) + 1);
      const editorId = p.audiovisual_id ?? c.audiovisual_id;
      if (editorId) {
        if (!edicionCount.has(p.cliente_id)) edicionCount.set(p.cliente_id, new Map());
        const m = edicionCount.get(p.cliente_id)!;
        m.set(editorId, (m.get(editorId) ?? 0) + 1);
      }
    }
    // historia / otro: las cubre la CM por pack, no se pagan aparte.
  }

  const out = new Map<string, PayrollLine[]>();
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };

  // Diseño (post + carrusel) → diseñador/a de la cuenta.
  for (const [clienteId, count] of disenoCount) {
    const c = clientById.get(clienteId)!;
    if (count <= 0) continue;
    add(c.disenador_id, {
      clienteId,
      cliente: c.nombre,
      concepto: `Diseño · ${count} ${count === 1 ? "pieza" : "piezas"}`,
      monto: count * rates.diseno_pieza,
      kind: "diseno",
    });
  }

  // Portadas de reel → diseñador/a de la cuenta.
  if (rates.portada_reel > 0) {
    for (const [clienteId, count] of portadaCount) {
      const c = clientById.get(clienteId)!;
      if (count <= 0) continue;
      add(c.disenador_id, {
        clienteId,
        cliente: c.nombre,
        concepto: `Portadas · ${count} ${count === 1 ? "reel" : "reels"}`,
        monto: count * rates.portada_reel,
        kind: "diseno",
      });
    }
  }

  // Edición (reel + video) → editor/a de cada pieza.
  for (const [clienteId, byEditor] of edicionCount) {
    const c = clientById.get(clienteId)!;
    for (const [editorId, count] of byEditor) {
      if (count <= 0) continue;
      add(editorId, {
        clienteId,
        cliente: c.nombre,
        concepto: `Edición · ${count} ${count === 1 ? "reel" : "reels"}`,
        monto: count * rates.edicion_reel,
        kind: "edicion",
      });
    }
  }

  return out;
}

/** Reparto del pool de coordinación de un mes entre personas (fracciones ~1). */
export interface CoordinationSplit {
  userId: string;
  pct: number; // fracción del pool de coordinación (0..1)
}

/**
 * Comisión recurrente de coordinación de Gestión de Redes: un % (`coordPct`,
 * ej 0.10) del abono mensual de cada cuenta con gestión de redes.
 *
 * Por defecto la cobra entera la coordinadora de la cuenta (coordinador_id, con
 * fallback al rol coordinador). Si el mes tiene un `split` (excepción cargada
 * para ese período), el pool de cada cuenta se reparte entre las personas del
 * split según su fracción — por ejemplo 5%/5% cuando dos personas se dividieron
 * el rol a mitad de mes. Función pura → testeable sin DB.
 */
export function computeCoordinationPayroll(
  clients: PayrollClient[],
  abonoByClient: Map<string, number>,
  coordPct: number,
  fallbackCoordinador: string | null,
  split: CoordinationSplit[] | null
): Map<string, PayrollLine[]> {
  const out = new Map<string, PayrollLine[]>();
  if (coordPct <= 0) return out;
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };
  const validSplit = split?.filter((s) => s.userId && s.pct > 0) ?? null;
  const hasSplit = !!validSplit && validSplit.length > 0;

  for (const c of clients) {
    const abono = abonoByClient.get(c.id) ?? 0;
    if (abono <= 0) continue;
    const pool = Math.round(abono * coordPct);
    if (pool <= 0) continue;

    if (hasSplit) {
      for (const s of validSplit!) {
        const monto = Math.round(pool * s.pct);
        if (monto === 0) continue;
        add(s.userId, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: `Coordinación gestión de redes (${pctLabel(coordPct * s.pct)})`,
          monto,
          kind: "comision",
        });
      }
    } else {
      add(c.coordinador_id ?? fallbackCoordinador, {
        clienteId: c.id,
        cliente: c.nombre,
        concepto: `Coordinación gestión de redes (${pctLabel(coordPct)})`,
        monto: pool,
        kind: "comision",
      });
    }
  }
  return out;
}

/** Formatea una fracción como porcentaje legible: 0.05 → "5%", 0.075 → "7.5%". */
function pctLabel(frac: number): string {
  const pct = frac * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
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

/** Fijo mensual del comercial por la gestión de mensajes/leads (independiente de cierres). */
export const COMERCIAL_FIXED_MENSUAL = 50000;

/** Porcentaje de comisión del closer según su intervención en la venta. */
export const COMMISSION_PCT = {
  ambos: 0.15, // cerró Y refirió (lead propio): 10% + 5%
  closer: 0.1, // solo cerró
  referido: 0.05, // solo refirió (lead propio de otro)
} as const;

/** Comisión de cierre del primer mes atribuida a quien cerró la cuenta. */
export interface FirstMonthCommission {
  closerId: string;
  clienteId: string;
  cliente: string;
  base: number;
  monto: number;
}

/**
 * Selecciona las comisiones de cierre AUTOMÁTICAS del primer mes para un período.
 * Un cliente califica si: su `fecha_inicio` cae en el período, tiene
 * `cerrado_por_id`, tiene abono recurrente > 0, y NO se le cargó ya una comisión
 * a mano (dedup vía `hasManualCommission`). Función pura → testeable sin DB.
 */
export function selectFirstMonthCommissions(
  clients: PayrollClient[],
  recurringByClient: Map<string, number>,
  periodo: string,
  cierrePct: number,
  hasManualCommission: (clienteId: string) => boolean
): FirstMonthCommission[] {
  if (cierrePct <= 0) return [];
  const out: FirstMonthCommission[] = [];
  for (const c of clients) {
    if ((c.fecha_inicio ?? "").slice(0, 7) !== periodo) continue;
    if (!c.cerrado_por_id) continue;
    if (hasManualCommission(c.id)) continue;
    const base = recurringByClient.get(c.id) ?? 0;
    if (base <= 0) continue;
    out.push({
      closerId: c.cerrado_por_id,
      clienteId: c.id,
      cliente: c.nombre,
      base,
      monto: Math.round(base * cierrePct),
    });
  }
  return out;
}

/**
 * Bonus por volumen de cierres del mes: por cada 2 clientes cerrados se suma
 * un 2% extra de comisión, con tope del 6%. Se aplica sobre la misma base que
 * la comisión (el abono del primer mes de cada cliente que cerró).
 * Devuelve la fracción a aplicar: 0, 0.02, 0.04 o 0.06.
 */
export function closerVolumeBonusPct(clientesCerrados: number): number {
  const pct = Math.min(Math.floor(clientesCerrados / 2) * 2, 6);
  return pct / 100;
}

/** Codifica/decodifica el detalle de una comisión en payroll_items.notas: "rol:base". */
export type CommissionRole = "closer" | "both" | "ref";
export function encodeCommissionNote(role: CommissionRole, base: number): string {
  return `${role}:${Math.round(base)}`;
}
export function decodeCommissionNote(
  notas: string | null
): { role: CommissionRole; base: number } | null {
  if (!notas) return null;
  const [role, baseStr] = notas.split(":");
  if (role !== "closer" && role !== "both" && role !== "ref") return null;
  const base = Number(baseStr);
  if (!Number.isFinite(base)) return null;
  return { role, base };
}
