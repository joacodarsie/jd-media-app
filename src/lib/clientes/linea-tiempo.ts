/**
 * La historia de una cuenta en una línea (18/10/2026): los hitos que importan
 * para la retención, en orden, para que cualquiera del equipo vea de un
 * vistazo cómo viene la relación. Puro y testeado; los datos los trae
 * `linea-tiempo-cuenta.tsx`.
 */

export type TipoHito = "alta" | "arranque" | "pieza" | "reunion" | "cobro" | "crecimiento" | "hoy";

export interface Hito {
  /** "YYYY-MM-DD" */
  fecha: string;
  tipo: TipoHito;
  titulo: string;
  detalle?: string;
}

export interface DatosLinea {
  fechaInicio: string | null;
  /** Arranque de 15 días: cuándo se terminó, o el avance si sigue abierto. */
  arranque: { terminadoEl: string | null; hechos: number; total: number } | null;
  primeraPieza: string | null;
  /** Piezas publicadas hasta hoy. */
  piezas: number;
  reuniones: string[];
  primerCobro: string | null;
  /** Seguidores en la foto de inicio y en la última. */
  seguidores: { inicio: number; hoy: number; fecha: string } | null;
}

const dia = (s: string) => s.slice(0, 10);

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${dia(b)}T12:00:00Z`) - Date.parse(`${dia(a)}T12:00:00Z`)) / 86_400_000);
}

export function armarLineaDeTiempo(d: DatosLinea, hoy: string): Hito[] {
  if (!d.fechaInicio) return [];
  const inicio = dia(d.fechaInicio);
  const hitos: Hito[] = [{ fecha: inicio, tipo: "alta", titulo: "Empezó con JD Media" }];

  if (d.arranque?.terminadoEl) {
    hitos.push({
      fecha: dia(d.arranque.terminadoEl),
      tipo: "arranque",
      titulo: "Arranque terminado",
      detalle: `en ${Math.max(1, diasEntre(inicio, d.arranque.terminadoEl))} días`,
    });
  }

  // Solo si cae cerca del alta: los cobros se registran desde jul-2026 y en una
  // cuenta vieja «primer pago» meses después confunde.
  if (d.primerCobro && diasEntre(inicio, d.primerCobro) <= 45)
    hitos.push({ fecha: dia(d.primerCobro), tipo: "cobro", titulo: "Primer pago" });

  if (d.primeraPieza) {
    hitos.push({
      fecha: dia(d.primeraPieza),
      tipo: "pieza",
      titulo: "Primera pieza publicada",
      detalle: `día ${diasEntre(inicio, d.primeraPieza) + 1}`,
    });
  }

  [...new Set(d.reuniones.map(dia))]
    .filter((f) => f >= inicio && f <= hoy)
    .sort()
    .forEach((f, i) => hitos.push({ fecha: f, tipo: "reunion", titulo: i === 0 ? "Primera reunión mensual" : "Reunión mensual" }));

  if (d.seguidores && d.seguidores.hoy !== d.seguidores.inicio && dia(d.seguidores.fecha) > inicio) {
    const delta = d.seguidores.hoy - d.seguidores.inicio;
    hitos.push({
      fecha: dia(d.seguidores.fecha),
      tipo: "crecimiento",
      titulo: `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR")} seguidores`,
      detalle: "desde que arrancó",
    });
  }

  hitos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Hoy, al final: cuántos días lleva y lo que falta del arranque si sigue abierto.
  const dias = diasEntre(inicio, hoy) + 1;
  const pendiente =
    d.arranque && !d.arranque.terminadoEl && d.arranque.total > 0
      ? `arranque: ${d.arranque.hechos} de ${d.arranque.total} pasos`
      : !d.primeraPieza
        ? "todavía sin piezas publicadas"
        : `${d.piezas} pieza${d.piezas === 1 ? "" : "s"} publicada${d.piezas === 1 ? "" : "s"}`;
  hitos.push({ fecha: dia(hoy), tipo: "hoy", titulo: `Hoy · día ${dias}`, detalle: pendiente });
  return hitos;
}
