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

/**
 * Extra de ONBOARDING para el equipo, SOLO el primer mes de cada cuenta (el
 * período que matchea `clients.fecha_inicio`): un % de la tarifa mensual de la
 * CM y del Paid Media, por el laburo exclusivo del arranque (accesos, rediseño
 * de perfiles, setup de pauta). El diseño/coordinación cobran el arranque por
 * el bonus del manual, así que no van acá. Cuentas con acuerdo fijo (override)
 * quedan afuera. Función pura → testeable sin DB.
 */
export function computeOnboardingExtras(
  clients: PayrollClient[],
  services: PayrollService[],
  rates: AgencyRates,
  periodo: string,
  fallbackMediaBuyerId: string | null
): Map<string, PayrollLine[]> {
  const pct = rates.onboarding_extra_pct ?? 0;
  const out = new Map<string, PayrollLine[]>();
  if (pct <= 0) return out;

  const byClient = new Map<string, PayrollService[]>();
  for (const s of services) {
    if (!byClient.has(s.cliente_id)) byClient.set(s.cliente_id, []);
    byClient.get(s.cliente_id)!.push(s);
  }
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };

  for (const c of clients) {
    // Solo el primer mes de la cuenta.
    if ((c.fecha_inicio ?? "").slice(0, 7) !== periodo) continue;
    const gestion = (byClient.get(c.id) ?? []).find((s) => s.tipo === "gestion_redes");
    if (!gestion || gestion.costo_override != null) continue; // sin gestión o acuerdo fijo
    const pack = (gestion.pack ?? "Personalizado") as RatePack;

    const cmExtra = Math.round((rates.cm[pack] ?? 0) * pct);
    if (cmExtra > 0) {
      add(c.cm_id, {
        clienteId: c.id,
        cliente: c.nombre,
        concepto: `Onboarding CM · +${Math.round(pct * 100)}% arranque`,
        monto: cmExtra,
        kind: "extra",
      });
    }

    if (gestion.media_buyer_aplica !== false) {
      const mbExtra = Math.round(mbCost(pack, rates) * pct);
      if (mbExtra > 0) {
        add(c.media_buyer_id ?? fallbackMediaBuyerId, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: `Onboarding Paid Media · +${Math.round(pct * 100)}% arranque`,
          monto: mbExtra,
          kind: "extra",
        });
      }
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
  /**
   * Responsable de producir la pieza: en reel/video es el EDITOR; en
   * post/carrusel es el DISEÑADOR. Puede diferir del asignado a la cuenta.
   */
  audiovisual_id: string | null;
  /** Diseñador/a de la PORTADA del reel (puede diferir del de la cuenta). */
  disenador_id: string | null;
}

/** Estados que cuentan como contenido entregado y pagable. */
const CONTENT_PAYABLE_STATES = new Set(["aprobado", "publicado"]);

/** Acumula una pieza atribuida a una persona dentro de una cuenta. */
type ContentTally = Map<string, { clienteId: string; cliente: string; personId: string; count: number }>;
function tallyInc(
  m: ContentTally,
  clienteId: string,
  cliente: string,
  personId: string
) {
  const key = `${clienteId}|${personId}`;
  const e = m.get(key);
  if (e) e.count += 1;
  else m.set(key, { clienteId, cliente, personId, count: 1 });
}

/**
 * Calcula las líneas de DISEÑO y EDICIÓN por el contenido REAL del mes, en vez
 * de por el pack contratado. Cuenta las publicaciones aprobadas/publicadas cuya
 * `fecha_publicacion` cae en el período, atribuyendo cada pieza a LA PERSONA que
 * figura en esa publicación (con fallback al equipo de la cuenta):
 *   - post + carrusel → diseño · diseñador de la pieza (audiovisual_id) → cuenta
 *   - reel + video    → edición · editor de la pieza (audiovisual_id) → cuenta
 *                       + portada · diseñador de la pieza (disenador_id) → cuenta
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

  const diseno: ContentTally = new Map(); // post + carrusel, por diseñador
  const portada: ContentTally = new Map(); // portadas de reel, por diseñador
  const edicion: ContentTally = new Map(); // reels, por editor

  for (const p of publications) {
    if (!CONTENT_PAYABLE_STATES.has(p.estado)) continue;
    if ((p.fecha_publicacion ?? "").slice(0, 7) !== periodo) continue;
    const c = clientById.get(p.cliente_id);
    if (!c) continue; // cuenta inactiva o interna
    if (overrideClientIds.has(p.cliente_id)) continue; // acuerdo fijo cubre todo

    if (p.tipo === "post" || p.tipo === "carrusel") {
      const designerId = p.audiovisual_id ?? c.disenador_id;
      if (designerId) tallyInc(diseno, c.id, c.nombre, designerId);
    } else if (p.tipo === "reel" || p.tipo === "video") {
      const editorId = p.audiovisual_id ?? c.audiovisual_id;
      if (editorId) tallyInc(edicion, c.id, c.nombre, editorId);
      const designerId = p.disenador_id ?? c.disenador_id;
      if (designerId) tallyInc(portada, c.id, c.nombre, designerId);
    }
    // historia / otro: las cubre la CM por pack, no se pagan aparte.
  }

  const out = new Map<string, PayrollLine[]>();
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };

  // Diseño (post + carrusel) → diseñador/a de cada pieza.
  for (const e of diseno.values()) {
    add(e.personId, {
      clienteId: e.clienteId,
      cliente: e.cliente,
      concepto: `Diseño · ${e.count} ${e.count === 1 ? "pieza" : "piezas"}`,
      monto: e.count * rates.diseno_pieza,
      kind: "diseno",
    });
  }

  // Portadas de reel → diseñador/a de cada portada.
  if (rates.portada_reel > 0) {
    for (const e of portada.values()) {
      add(e.personId, {
        clienteId: e.clienteId,
        cliente: e.cliente,
        concepto: `Portadas · ${e.count} ${e.count === 1 ? "reel" : "reels"}`,
        monto: e.count * rates.portada_reel,
        kind: "diseno",
      });
    }
  }

  // Edición (reel + video) → editor/a de cada pieza.
  for (const e of edicion.values()) {
    add(e.personId, {
      clienteId: e.clienteId,
      cliente: e.cliente,
      concepto: `Edición · ${e.count} ${e.count === 1 ? "reel" : "reels"}`,
      monto: e.count * rates.edicion_reel,
      kind: "edicion",
    });
  }

  return out;
}

/**
 * Coordinación de DISEÑO (Bri): 5% del diseño PUBLICADO del mes (post/carrusel
 * + portadas de reel), sobre las mismas piezas que se les pagan a los
 * diseñadores — la cuenta interna y las cuentas con acuerdo fijo quedan afuera.
 * Además, un plus por cada manual de marca aprobado de una cuenta nueva
 * (= mismo % sobre `manual_marca`). Todo se atribuye a la coordinación de diseño.
 * Función pura → testeable sin DB.
 */
export function computeDesignCoordinationLines(
  clients: PayrollClient[],
  publications: PayrollPublication[],
  overrideClientIds: Set<string>,
  rates: AgencyRates,
  periodo: string,
  manualAprobados: { clienteId: string; cliente: string }[]
): PayrollLine[] {
  const pct = rates.comision_coord_diseno ?? 0;
  if (pct <= 0) return [];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  let designBase = 0;
  for (const p of publications) {
    if (!CONTENT_PAYABLE_STATES.has(p.estado)) continue;
    if ((p.fecha_publicacion ?? "").slice(0, 7) !== periodo) continue;
    const c = clientById.get(p.cliente_id);
    if (!c) continue; // cuenta inactiva o interna (es_interno)
    if (overrideClientIds.has(p.cliente_id)) continue; // acuerdo fijo cubre todo
    if (p.tipo === "post" || p.tipo === "carrusel") designBase += rates.diseno_pieza;
    else if (p.tipo === "reel" || p.tipo === "video") designBase += rates.portada_reel;
  }

  const lines: PayrollLine[] = [];
  const pctMonto = Math.round(designBase * pct);
  if (pctMonto > 0) {
    lines.push({
      clienteId: null,
      cliente: "—",
      concepto: `Coordinación de diseño · ${Math.round(pct * 100)}% del diseño del mes`,
      monto: pctMonto,
      kind: "extra",
    });
  }

  const manualBonus = Math.round((rates.manual_marca ?? 0) * pct);
  if (manualBonus > 0) {
    for (const m of manualAprobados) {
      lines.push({
        clienteId: m.clienteId,
        cliente: m.cliente,
        concepto: `Aprobación manual de marca · ${m.cliente}`,
        monto: manualBonus,
        kind: "extra",
      });
    }
  }
  return lines;
}

/** Servicio de diseño gráfico standalone: campos relevantes para su reparto. */
export interface PayrollStandaloneDesignService {
  cliente_id: string;
  monto_mensual: number | null;
  costo_override: number | null;
  facturacion: string | null;
  created_at: string | null;
}

/**
 * Reparto del servicio de DISEÑO GRÁFICO STANDALONE (contrato aparte, sin
 * gestión de redes): 40% a quien diseña la cuenta (`clients.disenador_id`,
 * el mismo "equipo de la cuenta" que el resto de la app) + 10% a la
 * coordinación de diseño. La agencia se queda el 50% restante. Un acuerdo
 * fijo (`costo_override`) se paga entero al diseñador de la cuenta, sin split.
 * Función pura → testeable sin DB.
 */
export function computeStandaloneDesignLines(
  services: PayrollStandaloneDesignService[],
  clientDisenadorId: Map<string, string>,
  clientNombre: Map<string, string>,
  coordDisenoId: string | null,
  rates: AgencyRates,
  periodo: string
): Map<string, PayrollLine[]> {
  const out = new Map<string, PayrollLine[]>();
  const add = (userId: string | null, line: PayrollLine) => {
    if (!userId) return;
    if (!out.has(userId)) out.set(userId, []);
    out.get(userId)!.push(line);
  };

  for (const s of services) {
    const cliente = clientNombre.get(s.cliente_id);
    if (!cliente) continue; // cuenta inactiva o interna
    const esUnico = (s.facturacion ?? "mensual") === "unico";
    if (esUnico && (s.created_at ?? "").slice(0, 7) !== periodo) continue;
    const disenadorId = clientDisenadorId.get(s.cliente_id) ?? null;

    if (s.costo_override != null) {
      add(disenadorId, {
        clienteId: s.cliente_id,
        cliente,
        concepto: "Diseño gráfico standalone (acuerdo fijo)",
        monto: Number(s.costo_override),
        kind: "override",
      });
      continue;
    }

    const monto = Number(s.monto_mensual) || 0;
    const disenadorPct = rates.diseno_standalone_disenador_pct ?? 0;
    const coordPct = rates.diseno_standalone_coord_pct ?? 0;
    const disenadorMonto = Math.round(monto * disenadorPct);
    if (disenadorMonto > 0) {
      add(disenadorId, {
        clienteId: s.cliente_id,
        cliente,
        concepto: `Diseño gráfico standalone · ${Math.round(disenadorPct * 100)}%`,
        monto: disenadorMonto,
        kind: "diseno",
      });
    }
    const coordMonto = Math.round(monto * coordPct);
    if (coordMonto > 0) {
      add(coordDisenoId, {
        clienteId: s.cliente_id,
        cliente,
        concepto: `Coordinación de diseño standalone · ${Math.round(coordPct * 100)}%`,
        monto: coordMonto,
        kind: "extra",
      });
    }
  }

  return out;
}

/**
 * Diseño/edición pagados por el PACK CONTRATADO (modelo anterior): se usa para
 * los meses previos al corte de "pago por contenido real" (ver buildPeriodPayroll),
 * donde el calendario no necesariamente reflejó lo realmente producido. Atribuye
 * al equipo de la cuenta (disenador_id / audiovisual_id) la cantidad de piezas
 * del pack. Saltea cuentas con acuerdo fijo (override). Función pura.
 */
export function computePackContentPayroll(
  clients: PayrollClient[],
  services: PayrollService[],
  rates: AgencyRates
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
    const gestion = (byClient.get(c.id) ?? []).find((s) => s.tipo === "gestion_redes");
    if (!gestion || gestion.costo_override != null) continue; // sin gestión o acuerdo fijo
    const pd = gestion.pack_detalle ?? {};
    const posts = Number(pd.posts ?? 0);
    const reels = Number(pd.reels ?? 0);

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
      if (rates.portada_reel > 0) {
        add(c.disenador_id, {
          clienteId: c.id,
          cliente: c.nombre,
          concepto: `Portadas · ${reels} ${reels === 1 ? "reel" : "reels"}`,
          monto: reels * rates.portada_reel,
          kind: "diseno",
        });
      }
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
