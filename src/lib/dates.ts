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
