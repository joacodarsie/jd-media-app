import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { TIMEZONE } from "./constants";

export function fmtDate(value?: string | null, pattern = "dd/MM/yyyy") {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), TIMEZONE, pattern, { locale: es });
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
