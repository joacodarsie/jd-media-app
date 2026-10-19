/**
 * La racha de Mi día (19/10/2026): cuántos días hábiles seguidos cerraste
 * todo lo que te vencía. Ataca las tareas vencidas sin retar a nadie.
 *
 * Un día «se cumple» si todas las tareas tuyas que vencían ese día se cerraron
 * ese día o antes. Los días sin nada que venciera no cortan la racha pero
 * tampoco suman. Hoy suma solo si ya cerraste todo lo de hoy; si no, no corta
 * (el día no terminó). Las trabadas (esperan a otro) no cortan.
 */
export interface TareaRacha {
  fecha_limite: string | null;
  estado: string;
  /** ISO de cuándo se cerró. */
  fecha_completada: string | null;
  bloqueo?: string | null;
}

export const HITOS_RACHA = [3, 5, 10, 15, 20, 30, 50];

const sumarDias = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const esHabil = (ymd: string) => {
  const w = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return w >= 1 && w <= 5;
};
/** "YYYY-MM-DD" en Córdoba de un ISO. */
const diaDe = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10);

export function rachaDias(tareas: TareaRacha[], hoy: string, maxDias = 90): number {
  const porDia = new Map<string, TareaRacha[]>();
  for (const t of tareas) {
    if (!t.fecha_limite || t.estado === "archivada") continue;
    const d = t.fecha_limite.slice(0, 10);
    porDia.set(d, [...(porDia.get(d) ?? []), t]);
  }
  const cumplido = (d: string, t: TareaRacha) =>
    !!t.bloqueo || (t.estado === "completada" && (!t.fecha_completada || diaDe(t.fecha_completada) <= d));

  let racha = 0;
  // Hoy: suma si ya está todo; si no, todavía no corta.
  const deHoy = porDia.get(hoy) ?? [];
  if (deHoy.length && deHoy.every((t) => cumplido(hoy, t))) racha++;
  let d = hoy;
  for (let i = 0; i < maxDias; i++) {
    d = sumarDias(d, -1);
    if (!esHabil(d)) continue;
    const del = porDia.get(d) ?? [];
    if (!del.length) continue;
    if (!del.every((t) => cumplido(d, t))) break;
    racha++;
  }
  return racha;
}

/** El próximo hito a alcanzar (para «te faltan N»). */
export function proximoHito(racha: number): number | null {
  return HITOS_RACHA.find((h) => h > racha) ?? null;
}
