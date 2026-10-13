/**
 * Tareas con más de una persona (0199, 13/10/2026): el responsable
 * (`asignado_a_id`) más los colaboradores. «Mías» es cualquiera de los dos.
 * Puro.
 */
export function esDe(t: { asignado_a_id: string | null; colaboradores?: string[] | null }, userId: string): boolean {
  return t.asignado_a_id === userId || (t.colaboradores ?? []).includes(userId);
}

/** Filtro de PostgREST (`.or(...)`) para las tareas de una persona. */
export function filtroDePersona(userId: string): string {
  return `asignado_a_id.eq.${userId},colaboradores.cs.{${userId}}`;
}
