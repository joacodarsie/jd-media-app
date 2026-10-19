/**
 * La reunión de onboarding como día 1 del arranque (19/10/2026, pedido de
 * Luz). Lo puro: cuánto se corre cada paso abierto cuando se carga la fecha.
 */
export interface PasoFecha {
  id: string;
  estado: string;
  fecha_limite: string | null;
}

const dia = (ymd: string) => Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`);
const sumar = (ymd: string, d: number) => new Date(dia(ymd) + d * 86_400_000).toISOString().slice(0, 10);

/** Desde cuándo se cuenta el arranque: la reunión si está, si no el alta. */
export function inicioDelArranque(c: { onboarding_reunion?: string | null; fecha_inicio?: string | null }): string | null {
  return (c.onboarding_reunion ?? c.fecha_inicio ?? null)?.slice(0, 10) ?? null;
}

/**
 * Las nuevas fechas de los pasos abiertos: se corren los mismos días que se
 * movió el inicio. Lo hecho no se toca.
 */
export function correrPasos(pasos: PasoFecha[], inicioViejo: string, inicioNuevo: string): { id: string; fecha_limite: string }[] {
  const delta = Math.round((dia(inicioNuevo) - dia(inicioViejo)) / 86_400_000);
  if (delta === 0) return [];
  return pasos
    .filter((p) => p.fecha_limite && p.estado !== "completada" && p.estado !== "archivada")
    .map((p) => ({ id: p.id, fecha_limite: sumar(p.fecha_limite!, delta) }));
}
