/**
 * Toda tarea lleva fecha límite. Sin excepciones.
 *
 * El agujero que tapa: el aviso diario de vencidas filtra
 * `.not("fecha_limite", "is", null)`, así que una tarea sin fecha no está
 * vencida, no está por vencer y no existe para nadie. Al 10/9/2026 había **57
 * tareas abiertas sin fecha, las 57 con más de 30 días**: el onboarding sin
 * terminar de Amelia, Magic, Résonar y FUNDANIC. Nadie sabía que estaban ahí.
 *
 * La regla es de la tarea, no del objetivo: los objetivos de la agencia viven
 * en `agency_objectives` y una idea suelta no es una tarea. Acá se decide una
 * sola cosa y se decide en un solo lugar, para que valga igual en el formulario
 * que en la acción del servidor y que en lo que crea la IA.
 */

/** Cuántos días le damos a una tarea que llega sin fecha desde la IA. */
export const DIAS_POR_DEFECTO = 7;

export interface ResultadoFecha {
  ok: boolean;
  /** Qué decirle a quien la está cargando. Solo cuando `ok` es false. */
  error?: string;
  /** La fecha ya normalizada a `YYYY-MM-DD`. Solo cuando `ok` es true. */
  fecha?: string;
}

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida la fecha que se cargó a mano.
 *
 * No inventa nada: si falta, falla. Quien carga la tarea sabe para cuándo la
 * necesita mucho mejor que nosotros, y poner una fecha por defecto acá sería
 * volver a llenar la base de fechas que nadie eligió.
 */
export function validarFechaLimite(valor: string | null | undefined): ResultadoFecha {
  const f = (valor ?? "").trim();
  if (!f) {
    return { ok: false, error: "Poné una fecha límite: toda tarea tiene que tener una." };
  }
  if (!FORMATO.test(f)) {
    return { ok: false, error: "La fecha límite tiene que ser una fecha válida." };
  }
  // `2026-13-40` pasa el formato pero no es un día real.
  const d = new Date(f + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f) {
    return { ok: false, error: "La fecha límite tiene que ser una fecha válida." };
  }
  return { ok: true, fecha: f };
}

/**
 * La fecha para una tarea que crea la IA.
 *
 * Acá SÍ hay default: si el modelo no puso fecha, la alternativa es una tarea
 * invisible, que es justo lo que estamos tapando. Una fecha aproximada se
 * corrige en dos clics; una tarea sin fecha no la ve nadie nunca.
 */
export function fechaParaTareaDeIA(
  valor: string | null | undefined,
  hoy: string
): string {
  const v = validarFechaLimite(valor);
  if (v.ok) return v.fecha!;
  const base = new Date(hoy.slice(0, 10) + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + DIAS_POR_DEFECTO);
  return base.toISOString().slice(0, 10);
}

export interface TareaSinFecha {
  id: string;
  titulo: string | null;
  created_at: string;
  cliente_id: string | null;
  asignado_a_id: string | null;
}

/**
 * Ordena la cola de triage: primero lo más viejo, que es lo que más tiempo
 * lleva escondido. Dentro de la misma antigüedad, primero lo que no tiene
 * dueño, porque eso no lo va a reclamar nadie.
 */
export function ordenarParaTriage<T extends TareaSinFecha>(tareas: T[]): T[] {
  return [...tareas].sort((a, b) => {
    const da = Date.parse(a.created_at) || 0;
    const db = Date.parse(b.created_at) || 0;
    if (da !== db) return da - db;
    const sa = a.asignado_a_id ? 1 : 0;
    const sb = b.asignado_a_id ? 1 : 0;
    return sa - sb;
  });
}

/** Días que la tarea lleva abierta sin que nadie le haya puesto fecha. */
export function diasSinFecha(creadaEn: string, hoy: string): number {
  const d = Math.round(
    (Date.parse(hoy.slice(0, 10)) - Date.parse(creadaEn.slice(0, 10))) / 86_400_000
  );
  return d > 0 ? d : 0;
}
