/**
 * Agrupar la lista de tareas por ticket, como Jira.
 *
 * Por qué existe: desde la 0165 una tarea puede tener subtareas, pero la lista
 * las mostraba TODAS al mismo nivel. Un onboarding de 15 días metía 14 filas
 * sueltas en el medio de las otras 180, y nada decía que trece de ellas
 * colgaban de la primera. El dueño lo vio enseguida: *"el desglose de las
 * subtareas está un poco raro… no está funcionando del todo bien"*.
 *
 * Lo que hace: deja arriba los tickets y las tareas sueltas, y mete cada
 * subtarea adentro de su ticket. La excepción importante es la subtarea cuya
 * madre NO está en la vista —pasa siempre en "Mis tareas", donde a vos te
 * tocan tres piezas de un ticket que lleva otro— : esa se muestra igual, con
 * el ticket al que pertenece al lado, porque esconderla sería perderla.
 *
 * Puro: entra la lista ya filtrada y ordenada, sale la lista agrupada.
 */

export interface TareaAgrupable {
  id: string;
  parent_id?: string | null;
  numero?: number | null;
  titulo: string;
  fecha_limite?: string | null;
}

/** Referencia mínima al ticket madre, para nombrarlo sin traerlo entero. */
export interface RefMadre {
  id: string;
  numero: number | null;
  titulo: string;
}

export type FilaAgrupada<T extends TareaAgrupable> =
  /** Tarea sin desglose, o ticket cuyas subtareas no entran en el filtro. */
  | { tipo: "suelta"; tarea: T; madre: RefMadre | null }
  /** Ticket madre con su desglose visible. */
  | { tipo: "ticket"; tarea: T; subtareas: T[] };

/** Ordena el desglose por fecha y después por número: es el orden de trabajo. */
function ordenarSubtareas<T extends TareaAgrupable>(subs: T[]): T[] {
  return [...subs].sort(
    (a, b) =>
      (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999") ||
      (a.numero ?? 0) - (b.numero ?? 0)
  );
}

/**
 * Agrupa respetando el orden que ya traía la lista.
 *
 * `madresPorId` sirve para nombrar la madre de una subtarea huérfana; si no
 * está, la subtarea igual se muestra (sin el chip).
 */
export function agruparPorTicket<T extends TareaAgrupable>(
  tareas: T[],
  madresPorId: Record<string, RefMadre | undefined> = {}
): FilaAgrupada<T>[] {
  const presentes = new Set(tareas.map((t) => t.id));

  // Subtareas cuya madre SÍ está en la vista, agrupadas por madre.
  const hijasPorMadre = new Map<string, T[]>();
  for (const t of tareas) {
    const p = t.parent_id;
    if (!p || !presentes.has(p)) continue;
    const a = hijasPorMadre.get(p) ?? [];
    a.push(t);
    hijasPorMadre.set(p, a);
  }

  const filas: FilaAgrupada<T>[] = [];
  for (const t of tareas) {
    // Ya está adentro de su ticket: no va también arriba.
    if (t.parent_id && presentes.has(t.parent_id)) continue;

    const hijas = hijasPorMadre.get(t.id);
    if (hijas?.length) {
      filas.push({ tipo: "ticket", tarea: t, subtareas: ordenarSubtareas(hijas) });
    } else {
      filas.push({
        tipo: "suelta",
        tarea: t,
        madre: t.parent_id ? madresPorId[t.parent_id] ?? null : null,
      });
    }
  }
  return filas;
}

/** Cuántos tickets y cuántas subtareas hay, para el encabezado de la lista. */
export function contarAgrupadas<T extends TareaAgrupable>(
  filas: FilaAgrupada<T>[]
): { tickets: number; subtareas: number; sueltas: number } {
  let tickets = 0;
  let subtareas = 0;
  let sueltas = 0;
  for (const f of filas) {
    if (f.tipo === "ticket") {
      tickets++;
      subtareas += f.subtareas.length;
    } else {
      sueltas++;
    }
  }
  return { tickets, subtareas, sueltas };
}

/** Los ids de madre que hay que ir a buscar para nombrar las huérfanas. */
export function madresQueFaltan<T extends TareaAgrupable>(tareas: T[]): string[] {
  const presentes = new Set(tareas.map((t) => t.id));
  const faltan = new Set<string>();
  for (const t of tareas) {
    if (t.parent_id && !presentes.has(t.parent_id)) faltan.add(t.parent_id);
  }
  return [...faltan];
}
