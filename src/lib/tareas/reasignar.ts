/**
 * Reasignar las tareas abiertas de una cuenta cuando cambia su equipo.
 *
 * El problema real (agosto 2026): la tarea se asigna en el momento en que se
 * crea la pieza y después nadie la vuelve a tocar. Cuando una cuenta cambiaba
 * de diseñador o de community manager, las tareas viejas le quedaban colgadas
 * a la persona anterior — Darío tenía 2 piezas de cuentas que ya lleva Ana, y
 * en toda la app había 39 tareas apuntando a quien no correspondía o a nadie.
 *
 * Desde acá se corrige solo: cada vez que se guarda el equipo de una cuenta,
 * las tareas abiertas de esa cuenta pasan al responsable actual del área.
 *
 * Lo que NO se toca, a propósito:
 *  - Tareas ya completadas o archivadas (son historia).
 *  - Tareas de un área sin responsable cargado en la ficha (no hay a quién).
 *  - Tareas cuya área no corresponde a un rol de la cuenta (ej. Comercial).
 */

/** Qué persona de la ficha del cliente corresponde a cada área de tarea. */
export const AREA_A_RESPONSABLE = {
  "Diseño": "disenador_id",
  "Community Manager": "cm_id",
  "Edición Audiovisual": "audiovisual_id",
  "Paid Media": "media_buyer_id",
} as const;

export type AreaDeTarea = keyof typeof AREA_A_RESPONSABLE;

export interface EquipoDeCuenta {
  disenador_id?: string | null;
  cm_id?: string | null;
  audiovisual_id?: string | null;
  media_buyer_id?: string | null;
}

export interface TareaAsignable {
  id: string;
  area: string | null;
  asignado_a_id: string | null;
}

export interface Reasignacion {
  id: string;
  /** A quién pasa. */
  asignado_a_id: string;
  /** De quién venía (null = no tenía dueño). Solo para el aviso. */
  anterior: string | null;
}

/**
 * Qué tareas hay que mover, dado el equipo actual de la cuenta. Puro.
 *
 * `personasActivas` evita mandarle trabajo a alguien que ya no está en la
 * agencia: si el responsable de la ficha está inactivo, la tarea se deja como
 * está para que una persona decida.
 */
export function calcularReasignaciones(
  tareas: TareaAsignable[],
  equipo: EquipoDeCuenta,
  personasActivas: Set<string>,
): Reasignacion[] {
  const out: Reasignacion[] = [];
  for (const t of tareas) {
    const campo = AREA_A_RESPONSABLE[(t.area ?? "") as AreaDeTarea];
    if (!campo) continue;
    const correcto = equipo[campo] ?? null;
    if (!correcto) continue;
    if (correcto === t.asignado_a_id) continue;
    if (!personasActivas.has(correcto)) continue;
    out.push({ id: t.id, asignado_a_id: correcto, anterior: t.asignado_a_id });
  }
  return out;
}

/** Agrupa por destinatario, que es como se aplica y como se avisa. */
export function agruparPorPersona(rs: Reasignacion[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rs) {
    if (!m.has(r.asignado_a_id)) m.set(r.asignado_a_id, []);
    m.get(r.asignado_a_id)!.push(r.id);
  }
  return m;
}
