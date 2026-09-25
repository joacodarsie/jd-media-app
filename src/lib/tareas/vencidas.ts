/**
 * "Ponerse al día": las tareas vencidas de todo el equipo, por persona.
 *
 * Por qué existe: al 24/9/2026 había 156 tareas vencidas (Luz 48, Sol 30,
 * Belén 21, Carlos 17). El chip "Vencidas del equipo" ya las listaba, pero en
 * una sola tira de 156 renglones no se ve de quién es el atraso ni de qué
 * tipo es, y así nadie las despeja. Acá van agrupadas por persona y por tipo,
 * con las acciones a mano: hecha, nueva fecha o pasársela a otro.
 *
 * Puro: entra data, sale la vista armada. Sin base ni red.
 */

export type TipoVencida = "pieza" | "reunion" | "arranque" | "otra";

export const TIPOS_VENCIDA: { value: TipoVencida; label: string }[] = [
  { value: "pieza", label: "Piezas del calendario" },
  { value: "reunion", label: "Reuniones mensuales" },
  { value: "arranque", label: "Arranques" },
  { value: "otra", label: "Otras" },
];

export interface TareaVencidaInput {
  id: string;
  numero: number | null;
  titulo: string;
  fecha_limite: string;
  estado: string;
  asignado_a_id: string | null;
  cliente_id: string | null;
  /** Título de la tarea madre, si es subtarea. */
  madre_titulo?: string | null;
}

export interface Persona {
  id: string;
  nombre: string;
}

export interface TareaVencida extends TareaVencidaInput {
  tipo: TipoVencida;
  diasAtraso: number;
}

export interface GrupoPersona {
  persona: Persona | null;
  tareas: TareaVencida[];
  masVieja: number;
}

/** Las piezas las genera el calendario con estos prefijos (ver 0011 y 0019). */
const PREFIJOS_PIEZA = ["Editar pieza:", "Diseñar pieza:", "Hacer historia:"];

export function tipoDeTarea(t: Pick<TareaVencidaInput, "titulo" | "madre_titulo">): TipoVencida {
  const titulo = t.titulo.trim();
  if (PREFIJOS_PIEZA.some((p) => titulo.startsWith(p))) return "pieza";
  if (titulo.startsWith("Reunión mensual")) return "reunion";
  // Los pasos del arranque son subtareas de la madre "Onboarding 15 días — …".
  if (titulo.startsWith("Onboarding") || (t.madre_titulo ?? "").startsWith("Onboarding")) {
    return "arranque";
  }
  return "otra";
}

/** Días entre dos fechas "YYYY-MM-DD" (sin zona horaria de por medio). */
export function diasEntre(desde: string, hasta: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(hasta) - d(desde)) / 86_400_000);
}

const ABIERTAS = ["pendiente", "en_progreso", "en_revision", "bloqueada"];

export function armarVencidas(input: {
  tareas: TareaVencidaInput[];
  personas: Persona[];
  hoy: string;
}): GrupoPersona[] {
  const { tareas, personas, hoy } = input;
  const porId = new Map(personas.map((p) => [p.id, p]));

  const vencidas: TareaVencida[] = tareas
    .filter((t) => ABIERTAS.includes(t.estado) && t.fecha_limite < hoy)
    .map((t) => ({ ...t, tipo: tipoDeTarea(t), diasAtraso: diasEntre(t.fecha_limite, hoy) }));

  const grupos = new Map<string, GrupoPersona>();
  for (const t of vencidas) {
    const key = t.asignado_a_id ?? "";
    const g =
      grupos.get(key) ??
      ({ persona: t.asignado_a_id ? porId.get(t.asignado_a_id) ?? null : null, tareas: [], masVieja: 0 } as GrupoPersona);
    g.tareas.push(t);
    g.masVieja = Math.max(g.masVieja, t.diasAtraso);
    grupos.set(key, g);
  }

  for (const g of grupos.values()) {
    g.tareas.sort((a, b) => b.diasAtraso - a.diasAtraso || a.titulo.localeCompare(b.titulo));
  }
  // Primero quien más tiene: es donde está el cuello.
  return [...grupos.values()].sort((a, b) => b.tareas.length - a.tareas.length || b.masVieja - a.masVieja);
}
