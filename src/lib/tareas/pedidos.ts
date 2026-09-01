/**
 * Pedidos de cambio sobre una tarea: el equipo avisa que algo está mal y la
 * coordinación lo resuelve. Ver el porqué en la migración 0154.
 *
 * Este módulo es puro: define los motivos, qué se ofrece hacer con cada uno y
 * cómo se redactan los avisos.
 */

export type MotivoPedido =
  | "no_me_corresponde"
  | "error_en_la_tarea"
  | "falta_material"
  | "no_llego"
  | "otro";

export interface MotivoMeta {
  value: MotivoPedido;
  label: string;
  /** Qué ve quien reporta, para que elija bien. */
  ayuda: string;
  /** Qué se le propone a quien resuelve. */
  sugerencia: string;
}

export const MOTIVOS: MotivoMeta[] = [
  {
    value: "no_me_corresponde",
    label: "No me corresponde",
    ayuda: "No es de mi área o no llevo esa cuenta.",
    sugerencia: "Reasignarla al responsable de la cuenta.",
  },
  {
    value: "error_en_la_tarea",
    label: "Está mal cargada",
    ayuda: "El título, la cuenta, el tipo o la fecha están mal.",
    sugerencia: "Corregir la tarea o darla de baja si está duplicada.",
  },
  {
    value: "falta_material",
    label: "Falta material del cliente",
    ayuda: "No puedo avanzar hasta que llegue el crudo, el logo o la info.",
    sugerencia: "Reclamarle al cliente y correr la fecha.",
  },
  {
    value: "no_llego",
    label: "No llego con la fecha",
    ayuda: "Tengo el trabajo, pero no me da el tiempo.",
    sugerencia: "Correr la fecha o repartir la carga.",
  },
  {
    value: "otro",
    label: "Otro",
    ayuda: "Contalo en el detalle.",
    sugerencia: "Leer el detalle y decidir.",
  },
];

export function motivoMeta(v: string): MotivoMeta {
  return MOTIVOS.find((m) => m.value === v) ?? MOTIVOS[MOTIVOS.length - 1];
}

export type EstadoPedido = "pendiente" | "aprobada" | "rechazada";

/** Aviso que reciben los coordinadores cuando se reporta algo. */
export function mensajeParaCoordinacion(opts: {
  quien: string;
  motivo: string;
  tarea: string;
  cuenta?: string | null;
}): string {
  const donde = opts.cuenta ? ` (${opts.cuenta})` : "";
  return `🙋 ${opts.quien} reportó un problema en una tarea: "${motivoMeta(opts.motivo).label}" — ${opts.tarea}${donde}`;
}

/** Aviso que recibe quien reportó, cuando se resuelve. */
export function mensajeParaSolicitante(opts: {
  aprobada: boolean;
  tarea: string;
  nota?: string | null;
}): string {
  const cabeza = opts.aprobada
    ? `✅ Resolvimos lo que reportaste en "${opts.tarea}"`
    : `↩️ Miramos lo que reportaste en "${opts.tarea}" y la tarea queda como está`;
  return opts.nota?.trim() ? `${cabeza}: ${opts.nota.trim()}` : `${cabeza}.`;
}

/**
 * ¿Puede resolver pedidos? Coordinación y dirección. Un CM no resuelve el
 * pedido de otro, pero sí puede reportar el suyo.
 */
export const ROLES_QUE_RESUELVEN = ["admin", "coordinador", "coordinador_diseno"];
