/**
 * Tickets: el número y la jerarquía madre/subtarea.
 *
 * De la reunión del 13/9/2026. El dueño quiere que la plataforma funcione como
 * Jira para la producción de contenido: un ticket madre ("los 15 días de
 * contenido", "Destacadas") con el desglose adentro, y un número con el que
 * referirse a él —en una conversación y en la carpeta de Drive.
 *
 * Todo acá es puro: la jerarquía se decide con datos que ya vienen de la base.
 */

/** Prefijo del número de ticket. Global, no por cliente: ver migración 0165. */
export const TICKET_PREFIJO = "JD";

export interface TareaConNumero {
  id: string;
  numero: number | null;
  parent_id?: string | null;
  estado: string;
}

/** "JD-123". Devuelve null si la tarea todavía no tiene número. */
export function formatTicket(numero: number | null | undefined): string | null {
  if (numero == null || !Number.isFinite(numero)) return null;
  return `${TICKET_PREFIJO}-${numero}`;
}

/**
 * Lee un número de ticket escrito a mano. Acepta "JD-123", "jd 123", "#123" y
 * "123" pelado, porque en el buscador la gente escribe cualquiera de las cuatro.
 */
export function parseTicket(texto: string): number | null {
  const limpio = texto.trim().toLowerCase();
  const m = limpio.match(/^(?:jd[\s-]*|#)?(\d{1,9})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Estados que cuentan como terminada. `archivada` no: se sacó de circulación. */
const TERMINADAS = new Set(["completada", "archivada"]);

export function estaTerminada(estado: string): boolean {
  return TERMINADAS.has(estado);
}

export interface ProgresoTicket {
  hechas: number;
  total: number;
  /** 0 a 1. Un ticket sin subtareas da 0 y `sinSubtareas` en true. */
  pct: number;
  sinSubtareas: boolean;
}

/**
 * Cuánto avanzó un ticket madre según su desglose.
 *
 * Se mide por subtareas terminadas y no por el estado de la madre a propósito:
 * el estado de la madre lo pone una persona y se olvida, el desglose se mueve
 * solo a medida que el equipo trabaja.
 */
export function progresoTicket(subtareas: { estado: string }[]): ProgresoTicket {
  const total = subtareas.length;
  if (total === 0) return { hechas: 0, total: 0, pct: 0, sinSubtareas: true };
  const hechas = subtareas.filter((s) => estaTerminada(s.estado)).length;
  return { hechas, total, pct: hechas / total, sinSubtareas: false };
}

/**
 * Nombre de la carpeta de Drive de un ticket: "JD-123 - Destacadas".
 *
 * Sin caracteres que Drive maneje mal (`/` y `\` arman subcarpetas) y recortado,
 * porque un título largo hace una carpeta imposible de leer en la lista.
 */
export function nombreCarpetaDrive(numero: number | null, titulo: string): string {
  const limpio = titulo
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  const t = formatTicket(numero);
  if (!t) return limpio || "Sin título";
  return limpio ? `${t} - ${limpio}` : t;
}

/**
 * Agrupa una lista plana en tickets madre con sus subtareas, conservando el
 * orden de entrada.
 *
 * Una subtarea cuya madre no está en la lista —porque el filtro de la pantalla
 * la dejó afuera— se devuelve como suelta en vez de desaparecer: esconder
 * trabajo asignado es peor que mostrarlo sin su contexto.
 */
export function agruparEnTickets<T extends TareaConNumero>(
  tareas: T[]
): { madre: T; subtareas: T[] }[] {
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const subtareasPorMadre = new Map<string, T[]>();
  const madres: T[] = [];

  for (const t of tareas) {
    if (t.parent_id && porId.has(t.parent_id)) {
      const arr = subtareasPorMadre.get(t.parent_id) ?? [];
      arr.push(t);
      subtareasPorMadre.set(t.parent_id, arr);
    } else {
      madres.push(t);
    }
  }

  return madres.map((m) => ({ madre: m, subtareas: subtareasPorMadre.get(m.id) ?? [] }));
}
