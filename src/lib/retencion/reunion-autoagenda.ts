/**
 * El cliente elige el horario de su reunión mensual desde su portal
 * (19/10/2026). Hasta acá la coordinaba el director creativo a mano y en
 * octubre no se dio ninguna de las suyas: la reunión pasa a ser algo que pide
 * el cliente. Acá vive lo puro: qué turnos se le ofrecen.
 *
 * Turnos de 45 minutos entre el 1 y el 7 del mes que viene (el cierre del mes),
 * de 9 a 21 h de Córdoba (UTC-3), de lunes a sábado (pedido del dueño,
 * 19/10/2026). Si ya estamos entre el 1 y el 7, los días que quedan de esta
 * semana de cierre. Sin pisar las reuniones que ya tiene quien la da.
 */
export const HORAS_TURNO = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const DURACION_MIN = 45;
/** La semana del cierre: del 1 al 7 del mes. */
export const ULTIMO_DIA_REUNION = 7;

export interface Turno {
  /** ISO en UTC. */
  inicio: string;
  fin: string;
  /** "YYYY-MM-DD" en Córdoba. */
  dia: string;
  hora: number;
}

const OFFSET_H = 3; // Córdoba = UTC-3

export function turnoDe(dia: string, hora: number): Turno {
  const ini = Date.parse(`${dia}T00:00:00Z`) + (hora + OFFSET_H) * 3_600_000;
  return { inicio: new Date(ini).toISOString(), fin: new Date(ini + DURACION_MIN * 60_000).toISOString(), dia, hora };
}

const noEsDomingo = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay() !== 0;

/** Los días que se ofrecen: del 1 al 7 del mes que viene (o lo que queda de esta semana de cierre). */
export function diasDeReunion(hoy: string): string[] {
  const [y, m, d] = hoy.split("-").map(Number);
  const base = d < ULTIMO_DIA_REUNION ? { y, m, desde: d + 1 } : { y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, desde: 1 };
  const out: string[] = [];
  for (let dia = base.desde; dia <= ULTIMO_DIA_REUNION; dia++) {
    const ymd = `${base.y}-${String(base.m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (noEsDomingo(ymd)) out.push(ymd);
  }
  return out;
}

/** Los turnos libres de los próximos días hábiles, agrupables por `dia`. */
export function turnosLibres(hoy: string, ocupados: { inicio: string; fin: string }[]): Turno[] {
  const out: Turno[] = [];
  for (const d of diasDeReunion(hoy)) {
    for (const h of HORAS_TURNO) {
      const t = turnoDe(d, h);
      const a = Date.parse(t.inicio);
      const b = Date.parse(t.fin);
      if (ocupados.some((o) => Date.parse(o.inicio) < b && Date.parse(o.fin) > a)) continue;
      out.push(t);
    }
  }
  return out;
}

/** ¿Ese inicio es uno de los turnos ofrecidos? (lo valida el servidor). */
export function esTurnoValido(inicio: string, libres: Turno[]): Turno | null {
  return libres.find((t) => t.inicio === inicio) ?? null;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "jueves 23/10 a las 15 h" */
export function etiquetaTurno(t: { dia: string; hora: number }): string {
  const w = new Date(`${t.dia}T12:00:00Z`).getUTCDay();
  return `${DIAS[w]} ${Number(t.dia.slice(8, 10))}/${Number(t.dia.slice(5, 7))} a las ${t.hora} h`;
}
