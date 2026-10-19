/**
 * Logros chiquitos de Mi día (18/10/2026): reconocen lo que ya hiciste, sin
 * presionar. Solo aparecen los que se ganaron; los datos salen de tus tareas.
 */
export interface Logro {
  clave: string;
  emoji: string;
  texto: string;
}

export function logrosDelDia(d: {
  vencidas: number;
  hechasHoy: number;
  pendientesHoy: number;
  hechasSemana: number;
}): Logro[] {
  const l: Logro[] = [];
  if (d.hechasHoy > 0 && d.pendientesHoy === 0) l.push({ clave: "completo", emoji: "🏆", texto: "Día completo" });
  else if (d.hechasHoy > 0) l.push({ clave: "arranque", emoji: "🚀", texto: `Arrancaste: ${d.hechasHoy} hecha${d.hechasHoy === 1 ? "" : "s"} hoy` });
  if (d.vencidas === 0) l.push({ clave: "al-dia", emoji: "🔥", texto: "Al día: nada vencido" });
  if (d.hechasSemana >= 5) l.push({ clave: "racha", emoji: "⚡", texto: `En racha: ${d.hechasSemana} cerradas esta semana` });
  return l;
}
