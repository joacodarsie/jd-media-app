// Dos lecturas de la nómina que la vista por persona no da:
//
//   1. `summarizePayroll` — a dónde se va la plata del mes, agrupada por PUESTO
//      (cuánto de la nómina es diseño, cuánto coordinación, cuánto comisiones).
//   2. `payModelRules` — con qué REGLA se paga cada puesto, escrita a partir de
//      las tarifas vigentes, para no tener que leer el código o adivinar.
//
// Las dos usan las mismas claves de puesto, así que la UI puede mostrar la regla
// al lado de lo que efectivamente se pagó. Funciones puras → testeables sin DB.

import { mbCost, type AgencySettings } from "./coordinacion";
import type { PayrollLineKind, PersonPayroll } from "./payroll";

/** Puesto/concepto por el que se paga. Es la unidad de agrupación de la nómina. */
export type PuestoKey =
  | "cm"
  | "diseno"
  | "edicion"
  | "media_buyer"
  | "coordinacion"
  | "coord_general"
  | "coord_diseno"
  | "comercial"
  | "jornada"
  | "onboarding"
  | "servicio"
  | "override"
  | "extra"
  | "ajuste";

/** Cada tipo de línea de nómina cae en un puesto. */
const KIND_TO_PUESTO: Record<PayrollLineKind, PuestoKey> = {
  cm: "cm",
  diseno: "diseno",
  edicion: "edicion",
  media_buyer: "media_buyer",
  coordinacion: "coordinacion",
  coord_general: "coord_general",
  coord_diseno: "coord_diseno",
  comision: "comercial",
  comercial_fijo: "comercial",
  jornada: "jornada",
  onboarding: "onboarding",
  servicio: "servicio",
  override: "override",
  extra: "extra",
  ajuste: "ajuste",
};

export const PUESTO_LABEL: Record<PuestoKey, string> = {
  cm: "Community Manager",
  diseno: "Diseño",
  edicion: "Edición audiovisual",
  media_buyer: "Pauta (Media Buyer)",
  coordinacion: "Coordinación de redes",
  coord_general: "Coordinación general",
  coord_diseno: "Coordinación de diseño",
  comercial: "Comercial",
  jornada: "Jornadas de producción",
  onboarding: "Arranque de cuentas nuevas",
  servicio: "Otros servicios",
  override: "Acuerdos fijos por cuenta",
  extra: "Extras cargados a mano",
  ajuste: "Ajustes y descuentos",
};

/** Orden en que se muestran los puestos: primero producción, al final lo manual. */
const PUESTO_ORDER: PuestoKey[] = [
  "cm",
  "diseno",
  "edicion",
  "media_buyer",
  "coordinacion",
  "coord_general",
  "coord_diseno",
  "comercial",
  "jornada",
  "onboarding",
  "servicio",
  "override",
  "extra",
  "ajuste",
];

export interface PuestoBreakdown {
  key: PuestoKey;
  label: string;
  /** Total pagado por este puesto en el período (puede ser negativo en ajustes). */
  monto: number;
  /** Cuánto pesa sobre la nómina del mes, 0..100. */
  pctNomina: number;
  /** Quiénes cobran por este puesto, de mayor a menor. */
  personas: { userId: string; nombre: string; monto: number }[];
}

export interface PayrollSummary {
  total: number;
  puestos: PuestoBreakdown[];
}

/**
 * Agrupa la nómina ya calculada del período por puesto. Los ítems manuales se
 * atribuyen por su tipo: una comisión cargada a mano suma al comercial, un extra
 * o un descuento quedan aparte (son decisiones del mes, no el modelo de pago).
 */
export function summarizePayroll(people: PersonPayroll[]): PayrollSummary {
  const acc = new Map<PuestoKey, Map<string, { nombre: string; monto: number }>>();

  const add = (key: PuestoKey, p: PersonPayroll, monto: number) => {
    if (monto === 0) return;
    if (!acc.has(key)) acc.set(key, new Map());
    const porPersona = acc.get(key)!;
    const prev = porPersona.get(p.userId);
    if (prev) prev.monto += monto;
    else porPersona.set(p.userId, { nombre: p.nombre, monto });
  };

  for (const p of people) {
    for (const l of p.autoLines) add(KIND_TO_PUESTO[l.kind], p, l.monto);
    for (const it of p.manualItems) {
      const key: PuestoKey = it.tipo === "comision" ? "comercial" : it.tipo;
      add(key, p, it.monto);
    }
  }

  const total = people.reduce((a, p) => a + p.total, 0);

  const puestos: PuestoBreakdown[] = [];
  for (const key of PUESTO_ORDER) {
    const porPersona = acc.get(key);
    if (!porPersona || porPersona.size === 0) continue;
    const personas = [...porPersona.entries()]
      .map(([userId, v]) => ({ userId, nombre: v.nombre, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto);
    const monto = personas.reduce((a, x) => a + x.monto, 0);
    if (monto === 0) continue;
    puestos.push({
      key,
      label: PUESTO_LABEL[key],
      monto,
      pctNomina: total > 0 ? (monto / total) * 100 : 0,
      personas,
    });
  }

  return { total, puestos };
}

/** La regla con la que se paga un puesto, ya resuelta con las tarifas vigentes. */
export interface PayRule {
  key: PuestoKey;
  label: string;
  /** Una línea que resume el pago: "$10.000 por pieza publicada". */
  regla: string;
  /** Condiciones y excepciones que hacen variar ese número. */
  detalles: string[];
}

const ars = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const pct = (frac: number) => {
  const n = frac * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};

/**
 * Escribe, puesto por puesto, cómo se calcula lo que cobra. Sale de las tarifas
 * guardadas en Coordinación: si el admin cambia un número, cambia el texto.
 */
export function payModelRules(settings: AgencySettings): PayRule[] {
  const r = settings.rates;
  const packs = settings.packs.map((p) => p.id);
  const escalera = (tabla: Record<string, number>) =>
    packs.map((id) => `${id} ${ars(tabla[id] ?? 0)}`).join(" · ");
  const onbPlus = r.plus_primer_mes ?? 0;
  const onbPct = onbPlus > 0 ? 0 : r.onboarding_extra_pct ?? 0;
  const manualBonus = Math.round((r.manual_marca ?? 0) * (r.comision_coord_diseno ?? 0));
  const comercialFijo = r.comercial_fijo ?? 0;

  const rules: PayRule[] = [
    {
      key: "cm",
      label: PUESTO_LABEL.cm,
      regla: `Un fijo por mes según el pack de la cuenta: ${escalera(r.cm)}.`,
      detalles: [
        "Las historias van incluidas en esa tarifa: no se pagan aparte.",
        "Se cobra todos los meses mientras la cuenta esté activa, produzca lo que produzca.",
        onbPlus > 0
          ? `El primer mes de una cuenta nueva cobra un plus fijo de ${ars(onbPlus)} por el arranque.`
          : onbPct > 0
            ? `El primer mes de una cuenta nueva cobra ${pct(onbPct)} más por el arranque.`
            : "",
      ].filter(Boolean),
    },
    {
      key: "diseno",
      label: PUESTO_LABEL.diseno,
      regla: `${ars(r.diseno_pieza)} por pieza (post o carrusel) y ${ars(
        r.portada_reel ?? 0
      )} por portada de reel.`,
      detalles: [
        "Se paga por lo que realmente se publicó o aprobó ese mes, no por el pack contratado.",
        "Cobra quien figura en la publicación; si no hay nadie, el diseñador de la cuenta.",
        `Diseño gráfico standalone (contrato aparte): ${pct(
          r.diseno_standalone_disenador_pct ?? 0
        )} del monto del servicio.`,
      ],
    },
    {
      key: "edicion",
      label: PUESTO_LABEL.edicion,
      regla: `${ars(r.edicion_reel)} por reel o video publicado/aprobado en el mes.`,
      detalles: [
        "Igual que diseño: se paga el contenido real del mes, no el pack.",
        "La portada de ese reel la cobra aparte quien la diseñó.",
      ],
    },
    {
      key: "media_buyer",
      label: PUESTO_LABEL.media_buyer,
      regla: `Un fijo por mes según el pack: ${escalera(r.media_buyer)}.`,
      detalles: [
        "Solo si la cuenta tiene pauta contratada. Si no la tiene, ese costo no se paga y queda de ganancia.",
        onbPct > 0 ? `El primer mes de una cuenta nueva cobra ${pct(onbPct)} más.` : "",
      ].filter(Boolean),
    },
    {
      key: "coordinacion",
      label: PUESTO_LABEL.coordinacion,
      regla: `${pct(r.comision_coordinacion ?? 0)} del abono mensual de cada cuenta que coordina.`,
      detalles: [
        "Es recurrente: se cobra todos los meses, sobre lo que paga cada cliente.",
        'Si un mes el rol se repartió entre dos personas, se divide con el botón "Coordinación".',
      ],
    },
    {
      key: "coord_general",
      label: PUESTO_LABEL.coord_general,
      regla: `${pct(r.comision_coord_general ?? 0)} de lo que facturan los clientes, de cualquier servicio — salvo las cuentas con precio personalizado.`,
      detalles: [
        "Es la comisión de la coordinación general (mano derecha de la dirección).",
        "Se atribuye a quien tenga el área 'Coordinación General'.",
        "Las cuentas con pack Personalizado (hoy Boxescar, La Azotea, Dr Dionisi y La Botineta) no suman a esta comisión.",
      ],
    },
    {
      key: "coord_diseno",
      label: PUESTO_LABEL.coord_diseno,
      regla: `${pct(
        r.comision_coord_diseno ?? 0
      )} de todo el diseño publicado del mes (piezas + portadas).`,
      detalles: [
        manualBonus > 0
          ? `Además ${ars(manualBonus)} por cada manual de marca de una cuenta nueva que aprueba.`
          : "",
        `Del diseño gráfico standalone se lleva ${pct(r.diseno_standalone_coord_pct ?? 0)}.`,
      ].filter(Boolean),
    },
    {
      key: "comercial",
      label: PUESTO_LABEL.comercial,
      regla: comercialFijo
        ? `${ars(comercialFijo)} fijos por mes + ${pct(
            r.comision_cierre ?? 0
          )} del primer abono de cada cuenta que cierra.`
        : `${pct(r.comision_cierre ?? 0)} del primer abono de cada cuenta que cierra.`,
      detalles: [
        comercialFijo
          ? ""
          : "Hoy no tiene fijo mensual: cobra solo por lo que cierra. Se activa en Coordinación.",
        `Si además el lead era propio, suma ${pct(r.comision_lead_propio ?? 0)} más.`,
        "Bonus por volumen: +2% cada 2 cierres del mes, con tope de 6%.",
        "La comisión del cierre se carga sola el primer mes de la cuenta nueva.",
      ].filter(Boolean),
    },
    {
      key: "jornada",
      label: PUESTO_LABEL.jornada,
      regla: "Viáticos en partes iguales; del resto, 50% quien dirige y 30% quien acompaña.",
      detalles: ["El 20% restante queda para la agencia. Se cobra al terminar la jornada."],
    },
    {
      key: "onboarding",
      label: PUESTO_LABEL.onboarding,
      regla:
        onbPlus > 0
          ? `Plus fijo de ${ars(onbPlus)} para la CM y ${ars(onbPlus)} para el Media Buyer, solo el primer mes de la cuenta.`
          : onbPct > 0
            ? `${pct(onbPct)} extra sobre la tarifa de la CM y del Media Buyer, solo el primer mes de la cuenta.`
            : "Desactivado: hoy no se paga extra por el arranque de una cuenta nueva.",
      detalles: [
        "Paga el laburo que solo existe al arrancar: accesos, rediseño de perfiles, setup de pauta.",
        "El diseño no entra acá: su arranque lo cobra con el manual de marca.",
      ],
    },
    {
      key: "servicio",
      label: PUESTO_LABEL.servicio,
      regla: "Branding, web, Botly y proyectos: lo pactado en el servicio (un fijo o un % del monto).",
      detalles: [
        "Los de cobro único se pagan una sola vez, el mes en que se cargó el servicio.",
        "Se configura en el servicio de cada cliente, no acá.",
      ],
    },
    {
      key: "override",
      label: PUESTO_LABEL.override,
      regla: "Un monto pactado que cubre toda la gestión de esa cuenta.",
      detalles: [
        "Reemplaza al pago por pack y por contenido: esa cuenta no genera diseño ni edición aparte.",
      ],
    },
  ];

  return rules;
}

/** Cuánto pagás por un pack completo si lo mirás como suma de puestos. */
export function packPayoutBreakdown(settings: AgencySettings) {
  const r = settings.rates;
  return settings.packs.map((p) => {
    const portadas = p.portadas ?? p.reels;
    const cm = r.cm[p.id] ?? 0;
    const diseno = p.posts * r.diseno_pieza + portadas * (r.portada_reel ?? 0);
    const edicion = p.reels * r.edicion_reel;
    const pauta = mbCost(p.id, r);
    const coordinacion = Math.round(p.precio * (r.comision_coordinacion ?? 0));
    const coordDiseno = Math.round(diseno * (r.comision_coord_diseno ?? 0));
    const total = cm + diseno + edicion + pauta + coordinacion + coordDiseno;
    return {
      pack: p.id,
      precio: p.precio,
      cm,
      diseno,
      edicion,
      pauta,
      coordinacion,
      coordDiseno,
      total,
      queda: p.precio - total,
    };
  });
}
