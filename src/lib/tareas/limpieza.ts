/**
 * La limpieza semanal de tareas vencidas (24/10/2026, pedido del dueño). Al
 * 24/10 había 175 tareas vencidas en el equipo (Brisa 32, Carlos 27): muchas
 * ya estaban hechas o ya no iban, y con eso la lista dejaba de servir y los
 * números de la plataforma mentían. Cada uno ve las suyas y en cada una toca
 * «Ya está», «Pasala al…» o «Ya no va». Los lunes la plataforma lo recuerda.
 *
 * Módulo PURO: fechas "YYYY-MM-DD" leídas por sus dígitos.
 */

const t = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const sumar = (f: string, d: number) => ymd(t(f) + d * 86_400_000);
/** 0 = domingo … 6 = sábado. */
const diaSemana = (f: string) => new Date(t(f)).getUTCDay();

/** El próximo día hábil después de `hoy`. */
export function proximoHabil(hoy: string): string {
  let f = sumar(hoy, 1);
  while (diaSemana(f) === 0 || diaSemana(f) === 6) f = sumar(f, 1);
  return f;
}

/** El próximo lunes (si hoy es lunes, el de la semana que viene). */
export function proximoLunes(hoy: string): string {
  const d = diaSemana(hoy);
  return sumar(hoy, d === 1 ? 7 : (8 - d) % 7 || 7);
}

export interface OpcionDePase {
  label: string;
  fecha: string;
}

/** Las fechas rápidas de «Pasala al…». */
export function opcionesDePase(hoy: string): OpcionDePase[] {
  const habil = proximoHabil(hoy);
  const lunes = proximoLunes(hoy);
  const out: OpcionDePase[] = [{ label: diaSemana(hoy) === 5 ? "El lunes" : "Mañana", fecha: habil }];
  if (lunes !== habil) out.push({ label: "El lunes", fecha: lunes });
  out.push({ label: "En una semana", fecha: sumar(hoy, 7) });
  return out;
}

export function diasVencida(fechaLimite: string, hoy: string): number {
  return Math.round((t(hoy) - t(fechaLimite)) / 86_400_000);
}

export function haceCuanto(dias: number): string {
  if (dias <= 1) return "venció ayer";
  if (dias < 7) return `venció hace ${dias} días`;
  if (dias < 14) return "venció hace una semana";
  if (dias < 60) return `venció hace ${Math.round(dias / 7)} semanas`;
  return `venció hace ${Math.round(dias / 30)} meses`;
}

/** Los lunes se recuerda la limpieza a quien tenga vencidas. */
export const tocaRecordatorio = (hoy: string) => diaSemana(hoy) === 1;

export function mensajeLimpieza(n: number): string {
  return `🧹 Limpieza del lunes: tenés ${n} tarea${n === 1 ? "" : "s"} vencida${n === 1 ? "" : "s"}. En 5 minutos las dejás al día: «ya está», «pasala» o «ya no va».`;
}
