/**
 * Carga de trabajo de cada persona (19/10/2026): cuánto tiene para los
 * próximos 7 días (más lo vencido) contra lo que suele cerrar por semana.
 * Muestra quién está desbordado ANTES de que se atrase.
 */
export type NivelCarga = "desbordado" | "al_limite" | "bien" | "sin_datos";

export interface Carga {
  /** Abiertas que vencen en los próximos 7 días, más las vencidas. */
  pendientes: number;
  vencidas: number;
  /** Lo que cierra por semana (promedio de las últimas 4). */
  capacidad: number;
  /** pendientes / capacidad. */
  ratio: number | null;
  nivel: NivelCarga;
}

export function cargaDe(i: { pendientes7: number; vencidas: number; cerradas28: number }): Carga {
  const pendientes = i.pendientes7 + i.vencidas;
  const capacidad = Math.round((i.cerradas28 / 4) * 10) / 10;
  if (capacidad < 1) {
    // Sin historia suficiente: solo se marca si hay mucho vencido.
    return { pendientes, vencidas: i.vencidas, capacidad, ratio: null, nivel: i.vencidas >= 5 ? "desbordado" : "sin_datos" };
  }
  const ratio = Math.round((pendientes / capacidad) * 10) / 10;
  const nivel: NivelCarga = ratio > 1.3 ? "desbordado" : ratio >= 0.8 ? "al_limite" : "bien";
  return { pendientes, vencidas: i.vencidas, capacidad, ratio, nivel };
}
