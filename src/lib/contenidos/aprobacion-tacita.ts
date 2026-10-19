/**
 * Aprobación tácita (19/10/2026). La carta acuerdo lo dice: el cliente aprueba
 * las piezas terminadas el día 15 (o el 30) y, si vencido el plazo no aprobó ni
 * pidió cambios, **se dan por aprobadas** y se publican. Hasta acá no se
 * aplicaba: las piezas quedaban trabadas esperando al cliente.
 *
 * El plazo de una pieza es el más tardío entre:
 * - el día que la carta le da al cliente para aprobar las piezas de esa
 *   quincena (fin de ese día, hora de Córdoba), y
 * - 24 horas hábiles desde que se la mandamos (lo que la carta pide para
 *   responder): si la mandamos tarde, no se le acorta el tiempo al cliente.
 */
import { hitosRegulares, quincenaQueContiene } from "@/lib/ciclo/ciclo";

const OFFSET = 3 * 3_600_000; // Córdoba = UTC-3

/** Fin del día (23:59:59) en Córdoba, como instante. */
const finDelDia = (ymd: string) => Date.parse(`${ymd}T23:59:59Z`) + OFFSET;

/** Suma 24 horas hábiles (lunes a viernes) a un instante. */
export function mas24Habiles(desdeMs: number): number {
  let t = desdeMs;
  let restantes = 24 * 3_600_000;
  while (restantes > 0) {
    const local = new Date(t - OFFSET);
    const w = local.getUTCDay();
    const finDia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) + OFFSET;
    if (w === 0 || w === 6) {
      t = finDia;
      continue;
    }
    const tramo = Math.min(restantes, finDia - t);
    t += tramo;
    restantes -= tramo;
  }
  return t;
}

export function plazoAprobacion(fechaPublicacion: string, enviadaIso: string | null): Date {
  const q = quincenaQueContiene(fechaPublicacion.slice(0, 10));
  const hito = hitosRegulares(q.inicio).find((h) => h.clave === "aprueba_cliente_piezas");
  const porCarta = hito ? finDelDia(hito.hasta) : 0;
  const porEnvio = enviadaIso ? mas24Habiles(Date.parse(enviadaIso)) : 0;
  return new Date(Math.max(porCarta, porEnvio));
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "el jueves 15/10 a las 23:59" */
export function etiquetaPlazo(d: Date): string {
  const l = new Date(d.getTime() - OFFSET);
  const hh = String(l.getUTCHours()).padStart(2, "0");
  const mm = String(l.getUTCMinutes()).padStart(2, "0");
  return `el ${DIAS[l.getUTCDay()]} ${l.getUTCDate()}/${l.getUTCMonth() + 1} a las ${hh}:${mm}`;
}

export const NOTA_TACITA = "Aprobada por plazo vencido, como dice la carta acuerdo (el cliente no respondió a tiempo).";
