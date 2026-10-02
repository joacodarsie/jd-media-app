/**
 * Reglas de la agenda: de qué color va cada cosa y cómo se mueve de día.
 *
 * Pedido de Luz (2/10/2026): la agenda era toda de un color y para cambiar el
 * día de algo había que abrirlo y editarlo. Además nadie cargaba las jornadas de
 * producción en /coordinacion/jornadas, así que se agendan acá y se registran
 * solas para sueldos.
 *
 * Puro, para probarlo sin base.
 */

export type TipoEventoAgenda = "reunion" | "reunion_cliente" | "jornada" | "google";

export const TIPOS_AGENDA: { value: Exclude<TipoEventoAgenda, "google">; label: string }[] = [
  { value: "reunion", label: "Reunión del equipo" },
  { value: "reunion_cliente", label: "Reunión con cliente" },
  { value: "jornada", label: "Jornada de producción" },
];

/** El tipo de una reunión interna, por su marca y por si tiene cliente. */
export function tipoDeReunion(m: { tipo?: string | null; client_id?: string | null }): TipoEventoAgenda {
  if (m.tipo === "jornada") return "jornada";
  return m.client_id ? "reunion_cliente" : "reunion";
}

const ZONA_AR_MS = -3 * 3_600_000;

/** "YYYY-MM-DD" del día en Argentina de un instante ISO. */
export function diaArgentina(iso: string): string {
  return new Date(new Date(iso).getTime() + ZONA_AR_MS).toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Mueve un evento a otro día manteniendo la hora y la duración.
 * Devuelve null si cae en el mismo día.
 */
export function moverADia(
  ev: { starts_at: string; ends_at: string },
  nuevoDia: string
): { starts_at: string; ends_at: string } | null {
  const delta = diasEntre(diaArgentina(ev.starts_at), nuevoDia);
  if (delta === 0) return null;
  const ms = delta * 86_400_000;
  return {
    starts_at: new Date(new Date(ev.starts_at).getTime() + ms).toISOString(),
    ends_at: new Date(new Date(ev.ends_at).getTime() + ms).toISOString(),
  };
}

/** Horas de una jornada a partir de su duración: se cobra por hora empezada. */
export function horasDeJornada(startsAt: string, endsAt: string): number {
  const h = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
  return Math.max(1, Math.ceil(h - 1e-9));
}
