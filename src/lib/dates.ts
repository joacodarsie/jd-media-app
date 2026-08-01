import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { TIMEZONE } from "./constants";

/**
 * Días enteros transcurridos desde una fecha ISO. Devuelve null si no hay fecha
 * o es inválida. Fuente ÚNICA: antes estaba duplicada en prospección y comercial
 * con comportamientos distintos (una devolvía 0 en vez de null).
 */
export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

export function fmtDate(value?: string | null, pattern = "dd/MM/yyyy") {
  if (!value) return "—";
  // Date-only ("YYYY-MM-DD") debe interpretarse como dia local — no como UTC
  // midnight, que se renderiza un dia menos en TZ negativas (ej Cordoba UTC-3).
  // Si es date-only, anclamos a las 12:00 UTC para que cualquier TZ entre
  // UTC-11 y UTC+11 caiga el mismo dia calendario.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0))
    : new Date(value);
  return formatInTimeZone(date, TIMEZONE, pattern, { locale: es });
}

export function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), TIMEZONE, "dd/MM HH:mm", {
    locale: es,
  });
}

/** Estado de una fecha límite respecto de hoy (zona Córdoba). */
/**
 * Hoy en la zona horaria de la agencia (Córdoba), formato YYYY-MM-DD.
 * `new Date().toISOString()` da UTC y después de las 21:00 ya devuelve el día
 * siguiente: con eso, una tarea de hoy se marcaba como vencida a la noche.
 */
export function hoyYmd(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

/**
 * ¿La tarea está vencida DE ESTE MES? (o del mes pasado, dentro de los
 * primeros días, para no perder de vista lo de la semana anterior).
 *
 * Por qué existe: "Mi día" listaba como vencida cualquier tarea con fecha
 * pasada, así que aparecían tareas de mayo — muchas ya hechas y nunca marcadas
 * — mezcladas con lo de hoy. Con 173 vencidas acumuladas, la lista dejó de
 * significar algo y se ignora entera. Lo viejo no desaparece: se muestra
 * aparte, agrupado, para limpiarlo en lote.
 *
 * La ventana es "desde el 1° del mes actual", con una gracia de 7 días al
 * empezar el mes (si hoy es 3 de agosto, lo del 28 de julio sigue siendo
 * reciente).
 */
export function esVencidaReciente(
  fechaLimite: string | null | undefined,
  hoyYmd: string
): boolean {
  if (!fechaLimite) return false;
  const limite = fechaLimite.slice(0, 10);
  if (limite >= hoyYmd) return false; // todavía no venció
  return limite >= inicioVentanaVencidas(hoyYmd);
}

/** Primer día que se considera "reciente" para las vencidas. */
export function inicioVentanaVencidas(hoyYmd: string): string {
  const [y, m, d] = hoyYmd.split("-").map(Number);
  // En los primeros 7 días del mes seguimos mirando el mes anterior completo.
  if (d <= 7) {
    const mesAnterior = m === 1 ? 12 : m - 1;
    const anio = m === 1 ? y - 1 : y;
    return `${anio}-${String(mesAnterior).padStart(2, "0")}-01`;
  }
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function dueState(
  fechaLimite?: string | null,
  estado?: string
): "vencida" | "hoy" | "pronto" | "ok" | "none" {
  if (!fechaLimite || estado === "completada") return "none";
  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const limite = fechaLimite.slice(0, 10);
  if (limite < hoy) return "vencida";
  if (limite === hoy) return "hoy";
  const diff =
    (new Date(limite + "T00:00:00").getTime() -
      new Date(hoy + "T00:00:00").getTime()) /
    86400000;
  if (diff <= 2) return "pronto";
  return "ok";
}
