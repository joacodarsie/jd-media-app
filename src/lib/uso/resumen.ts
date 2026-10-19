/**
 * Qué secciones de la plataforma se usan (19/10/2026, 0204). Lo puro: junta
 * las filas por sección y detecta las del menú que nadie abrió.
 */
export interface FilaUso {
  user_id: string;
  seccion: string;
  dia: string;
  vistas: number;
}

export interface SeccionUso {
  seccion: string;
  vistas: number;
  /** Cuántas personas distintas la abrieron. */
  personas: number;
}

export function resumirUso(filas: FilaUso[], delMenu: string[], excluir: Set<string> = new Set()) {
  const por = new Map<string, { vistas: number; personas: Set<string> }>();
  for (const f of filas) {
    if (excluir.has(f.user_id)) continue;
    const e = por.get(f.seccion) ?? { vistas: 0, personas: new Set<string>() };
    e.vistas += f.vistas;
    e.personas.add(f.user_id);
    por.set(f.seccion, e);
  }
  const secciones: SeccionUso[] = [...por.entries()]
    .map(([seccion, e]) => ({ seccion, vistas: e.vistas, personas: e.personas.size }))
    .sort((a, b) => b.vistas - a.vistas || a.seccion.localeCompare(b.seccion, "es"));
  const usadas = new Set(secciones.map((s) => s.seccion));
  const nunca = [...new Set(delMenu)].filter((s) => !usadas.has(s));
  const dias = new Set(filas.map((f) => f.dia)).size;
  return { secciones, nunca, dias };
}
