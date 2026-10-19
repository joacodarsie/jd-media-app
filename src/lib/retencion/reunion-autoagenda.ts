/**
 * El cliente elige el horario de su reunión mensual desde su portal
 * (19/10/2026). Hasta acá la coordinaba el director creativo a mano y en
 * octubre no se dio ninguna de las suyas: la reunión pasa a ser algo que pide
 * el cliente. Acá vive lo puro: qué turnos se le ofrecen.
 *
 * Turnos de 45 minutos, de lunes a viernes, en horario de Córdoba (UTC-3, sin
 * horario de verano), desde mañana y durante los próximos días hábiles, sin
 * pisar las reuniones que ya tiene quien la da.
 */
export const HORAS_TURNO = [10, 11, 12, 15, 16, 17];
export const DURACION_MIN = 45;
export const DIAS_HABILES = 6;

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

const sumarDias = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const esHabil = (ymd: string) => {
  const w = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return w >= 1 && w <= 5;
};

/** Los turnos libres de los próximos días hábiles, agrupables por `dia`. */
export function turnosLibres(hoy: string, ocupados: { inicio: string; fin: string }[]): Turno[] {
  const out: Turno[] = [];
  let d = hoy;
  let habiles = 0;
  while (habiles < DIAS_HABILES) {
    d = sumarDias(d, 1);
    if (!esHabil(d)) continue;
    habiles++;
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
