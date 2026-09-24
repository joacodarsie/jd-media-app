// Reunión agendada con un prospecto: los textos y el link a Google Calendar.
//
// Puro, para testearlo. Las horas se escriben SIEMPRE en hora de Argentina:
// el server de Vercel corre en UTC, y sin fijar la zona una reunión de las
// 15 se avisaba "a las 18".

export const ZONA_AR = "America/Argentina/Cordoba";

/** "jue 25/9, 15:00" */
export function cuandoReunion(iso: string): string {
  // Armado a mano: según la versión de ICU, "es-AR" da "25/9" o "25-9".
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_AR,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso));
  const de = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${de("weekday").replace(".", "")} ${de("day")}/${de("month")}, ${horaAr(iso)}`;
}

/** "15:00" en hora de Argentina. */
export function horaAr(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: ZONA_AR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Día (YYYY-MM-DD) en Argentina de un instante. */
export function diaAr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-CA", { timeZone: ZONA_AR });
}

export function tituloReunion(empresa: string): string {
  return `Reunión comercial · ${empresa.trim()}`;
}

/** Formato de Google Calendar: 20260925T180000Z (UTC). */
function gcal(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Link que abre Google Calendar con el evento ya cargado. No necesita permisos
 * de escritura sobre la cuenta (la conexión de la app es de solo lectura):
 * la persona toca "Guardar" y queda en su calendario, con aviso en el celular.
 */
export function linkGoogleCalendar(input: {
  titulo: string;
  inicio: string;
  fin: string;
  detalle?: string | null;
  ubicacion?: string | null;
}): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: input.titulo,
    dates: `${gcal(new Date(input.inicio))}/${gcal(new Date(input.fin))}`,
    ctz: ZONA_AR,
  });
  if (input.detalle) p.set("details", input.detalle);
  if (input.ubicacion) p.set("location", input.ubicacion);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export interface ReunionDelDia {
  titulo: string;
  starts_at: string;
  asistentes: string[];
}

/**
 * El aviso de la mañana: a cada persona, sus reuniones de HOY en una sola
 * notificación, ordenadas por hora.
 */
export function avisosDeHoy(
  reuniones: ReunionDelDia[],
  hoy: string
): Map<string, string> {
  const porPersona = new Map<string, ReunionDelDia[]>();
  for (const r of reuniones) {
    if (diaAr(r.starts_at) !== hoy) continue;
    for (const u of new Set(r.asistentes)) {
      const l = porPersona.get(u) ?? [];
      l.push(r);
      porPersona.set(u, l);
    }
  }
  const out = new Map<string, string>();
  for (const [u, l] of porPersona) {
    l.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const partes = l.map((r) => `${horaAr(r.starts_at)} ${r.titulo}`);
    out.set(
      u,
      l.length === 1 ? `Hoy tenés reunión: ${partes[0]}` : `Hoy tenés ${l.length} reuniones: ${partes.join(" · ")}`
    );
  }
  return out;
}
