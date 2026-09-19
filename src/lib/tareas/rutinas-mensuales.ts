/**
 * Las tareas que hay que hacer todos los meses, generadas solas.
 *
 * Por qué existe: cobrarles a los clientes del 1 al 5, pagarle al equipo el 7
 * y cerrar el mes anterior se repiten siempre igual y dependen de que alguien
 * se acuerde. En julio, agosto y septiembre de 2026 los egresos quedaron en
 * cero en el resumen porque nadie registró lo que se pagó.
 *
 * ⚠️ La **reunión mensual de cada cuenta** NO se genera acá: ya la crea
 * `lib/retencion/reunion-mensual` desde el cron diario. Duplicarla sería
 * mandarle dos tickets iguales a la misma persona.
 *
 * Este módulo es PURO: recibe el período, las cuentas activas y quién ocupa
 * cada puesto, y devuelve qué tareas tienen que existir ese mes. Quien las
 * inserta es el cron (`api/cron/rutinas-mensuales`), y `rutina_key` —única en
 * la base— es lo que hace que correrlo dos veces no duplique nada.
 *
 * El aviso al responsable no se programa acá: al insertar la tarea, el trigger
 * `notify_task_assignment` le avisa como con cualquier otra.
 */

/** Quién ocupa cada puesto hoy. Todos pueden faltar: se cae al admin. */
export interface GenteRutina {
  /** Coordinación General (Leo). */
  coordGeneralId: string | null;
  /** El dueño. Es el último recurso: una tarea sin responsable no existe. */
  adminId: string | null;
}

export interface TareaRutina {
  /** Única por período: correr el cron de nuevo no duplica. */
  rutina_key: string;
  titulo: string;
  descripcion: string;
  area: string;
  prioridad: string;
  asignado_a_id: string | null;
  cliente_id: string | null;
  /** Fecha límite YYYY-MM-DD. */
  fecha_limite: string;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10" → "octubre de 2026". */
export function mesLabel(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return `${MESES[(m || 1) - 1]} de ${y}`;
}

/** El período anterior: "2026-01" → "2025-12". */
function periodoAnterior(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Día `dia` del período, recortado si el mes es más corto. */
function fechaDe(periodo: string, dia: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/**
 * Qué tareas tienen que existir en `periodo` (YYYY-MM).
 *
 * Las fechas salen del calendario de la plata ya acordado: los clientes pagan
 * del 1 al 5 y al equipo se le paga a mes vencido, el 7.
 */
export function rutinasDelMes(periodo: string, gente: GenteRutina): TareaRutina[] {
  const anterior = periodoAnterior(periodo);
  const mes = mesLabel(periodo);
  const mesAnterior = mesLabel(anterior);
  // Si el puesto está vacante, la tarea igual tiene dueño: el dueño de la agencia.
  const finanzas = gente.coordGeneralId ?? gente.adminId;
  const out: TareaRutina[] = [];

  out.push({
    rutina_key: `${periodo}:cobrar`,
    titulo: `Cobrarles a los clientes de ${mes}`,
    descripcion:
      "Los clientes pagan por adelantado **del 1 al 5**. Marcá cada cobro en *¿Quién me pagó?* a medida que entra: lo que no queda marcado no existe en los números del mes.",
    area: "Coordinación General",
    prioridad: "alta",
    asignado_a_id: finanzas,
    cliente_id: null,
    fecha_limite: fechaDe(periodo, 5),
  });

  out.push({
    rutina_key: `${periodo}:cerrar-mes`,
    titulo: `Cerrar ${mesAnterior}: gastos y pagos cargados`,
    descripcion:
      `Revisar que ${mesAnterior} tenga **todo lo que salió**: gastos del mes y pagos al equipo. Es lo que hace que el margen del resumen sea real y no una estimación.`,
    area: "Coordinación General",
    prioridad: "media",
    asignado_a_id: finanzas,
    cliente_id: null,
    fecha_limite: fechaDe(periodo, 5),
  });

  out.push({
    rutina_key: `${periodo}:sueldos`,
    titulo: `Pagar los sueldos de ${mesAnterior}`,
    descripcion:
      "Al equipo se le paga **a mes vencido, el día 7**. Después de pagar, registrar cada pago en Sueldos: sin eso el mes queda con egresos en cero.",
    area: "Coordinación General",
    prioridad: "alta",
    asignado_a_id: gente.adminId ?? finanzas,
    cliente_id: null,
    fecha_limite: fechaDe(periodo, 7),
  });

  // Solo las que tienen a quién asignarse: una tarea sin responsable no le
  // aparece a nadie y no dispara ningún aviso.
  return out.filter((t) => !!t.asignado_a_id);
}
