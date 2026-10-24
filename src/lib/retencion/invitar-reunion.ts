/**
 * Invitar al cliente a su reunión mensual (22/10/2026).
 *
 * El 22/10 había 14 cuentas activas sin reunión de octubre. El ticket existía
 * en todas y el portal ya ofrecía 71 turnos para que el cliente eligiera, pero
 * **ningún cliente se enteró**: nadie les mandó el link. Las 7 que se dieron
 * fueron las que coordinó Luz a mano.
 *
 * Esto arma el mensaje con el link al portal (donde el cliente elige día y
 * hora) y dice en qué está cada cuenta, para que el que tiene el ticket vea
 * de un vistazo a quién le falta invitar. Puro: entra la data, sale el texto.
 */
import { periodLabel } from "@/lib/finanzas";

export type EstadoReunion = "hecha" | "agendada" | "invitada" | "sin_invitar";

export const ESTADO_REUNION: Record<EstadoReunion, { label: string; orden: number }> = {
  sin_invitar: { label: "Sin invitar", orden: 0 },
  invitada: { label: "Invitada, esperando que elija", orden: 1 },
  agendada: { label: "Agendada", orden: 2 },
  hecha: { label: "Hecha", orden: 3 },
};

/** Una reunión registrada gana a todo; después, una agendada; después, la invitación. */
export function estadoReunion(input: { hecha: boolean; agendada: string | null; invitadaEl: string | null }): EstadoReunion {
  if (input.hecha) return "hecha";
  if (input.agendada) return "agendada";
  if (input.invitadaEl) return "invitada";
  return "sin_invitar";
}

/**
 * Cómo saludar. El contacto a veces es una razón social («Seguimiento Satelital
 * SAS») o el mismo nombre de la cuenta («Catch»): ahí va un «¡Hola!» sin nombre.
 * Los nombres cargados en mayúsculas se pasan a nombre propio.
 */
export function saludo(contacto: string | null | undefined, cuenta: string): string {
  const c = contacto?.trim();
  if (!c) return "¡Hola!";
  if (c.toLowerCase() === cuenta.trim().toLowerCase()) return "¡Hola!";
  if (/\b(s\.?a\.?s?|s\.?r\.?l|sociedad|ltda|inc)\b\.?$/i.test(c)) return "¡Hola!";
  const primero = c.split(/\s+/)[0];
  const nombre = primero === primero.toUpperCase() ? primero[0] + primero.slice(1).toLowerCase() : primero;
  return `¡Hola ${nombre}!`;
}

/** El link del portal que abre directo en «Elegí cuándo nos juntamos». */
export function linkReunion(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/c/${token}?ver=reunion#reunion`;
}

export function mensajeInvitacion(input: {
  contacto: string | null | undefined;
  cuenta: string;
  periodo: string; // 'YYYY-MM'
  link: string;
  /** «del 2 al 7 de noviembre»: los días que ofrece el portal. */
  dias?: string | null;
  deParte?: string | null;
}): string {
  const mes = periodLabel(input.periodo).toLowerCase().replace(/\s*(de\s+)?\d{4}$/, "");
  const firma = input.deParte?.trim() ? `\n\n${input.deParte.trim().split(/\s+/)[0]} — JD Media` : "";
  return (
    `${saludo(input.contacto, input.cuenta)} Queremos juntarnos a repasar ${mes} de ${input.cuenta}: ` +
    `lo que salió, los números y lo que se viene. Son 30 minutos por Meet.\n\n` +
    `Elegí el día y el horario que te queden cómodos${input.dias ? ` (${input.dias})` : ""} acá:\n${input.link}${firma}`
  );
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** ["2026-11-02", …, "2026-11-07"] → «del 2 al 7 de noviembre». */
export function rangoDias(dias: string[]): string | null {
  if (!dias.length) return null;
  const a = dias[0];
  const b = dias[dias.length - 1];
  const mes = MESES[+b.slice(5, 7) - 1];
  if (a === b) return `el ${+a.slice(8, 10)} de ${mes}`;
  return `del ${+a.slice(8, 10)} al ${+b.slice(8, 10)} de ${mes}`;
}
