/**
 * El embudo de jdmedia.com.ar (13/10/2026): cuánta gente entra, de dónde viene
 * y cuántos dan el paso (escribir por WhatsApp, descargar un recurso, dejar una
 * reseña). La web le avisa a la plataforma; acá se ordena.
 *
 * Puro: entra lo que mandó la web, sale lo que ve el dueño en Dirección.
 */

export type TipoEvento = "visita" | "whatsapp" | "resena" | "recurso";
export const TIPOS_EVENTO: TipoEvento[] = ["visita", "whatsapp", "resena", "recurso"];

/**
 * De dónde vino la visita, en palabras: primero el utm_source (los links de la
 * bio y de la pauta lo traen), si no, el sitio que la mandó.
 */
export function fuenteDe(utmSource: string | null | undefined, referrer: string | null | undefined): string {
  const u = (utmSource ?? "").toLowerCase().trim();
  if (u) {
    if (/^(ig|instagram)/.test(u)) return "Instagram";
    if (/^(fb|facebook|meta)/.test(u)) return "Facebook";
    if (/google|gbp|gmb/.test(u)) return "Google";
    if (/whats|wa\b/.test(u)) return "WhatsApp";
    if (/tiktok/.test(u)) return "TikTok";
    if (/linkedin/.test(u)) return "LinkedIn";
    return "Otra campaña";
  }
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (!host || host.endsWith("jdmedia.com.ar")) return "Directo";
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("facebook") || host === "l.facebook.com" || host === "lm.facebook.com") return "Facebook";
  if (host.includes("google")) return "Google";
  if (host.includes("whatsapp") || host === "wa.me") return "WhatsApp";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("linkedin") || host === "lnkd.in") return "LinkedIn";
  if (host.includes("bing") || host.includes("duckduckgo") || host.includes("yahoo")) return "Otro buscador";
  return "Otro sitio";
}

export interface EventoWeb {
  tipo: string;
  fuente: string | null;
  created_at: string;
}

export interface ResumenWeb {
  visitas: number;
  whatsapp: number;
  recursos: number;
  resenas: number;
  /** De cada 100 visitas, cuántas escribieron por WhatsApp. null sin visitas. */
  tasa: number | null;
  /** Visitas por fuente, de la que más trae a la que menos. */
  fuentes: { fuente: string; visitas: number }[];
}

export function resumirWeb(eventos: EventoWeb[]): ResumenWeb {
  const cuenta = (t: TipoEvento) => eventos.filter((e) => e.tipo === t).length;
  const visitas = cuenta("visita");
  const whatsapp = cuenta("whatsapp");
  const porFuente = new Map<string, number>();
  for (const e of eventos)
    if (e.tipo === "visita") porFuente.set(e.fuente || "Directo", (porFuente.get(e.fuente || "Directo") ?? 0) + 1);
  return {
    visitas,
    whatsapp,
    recursos: cuenta("recurso"),
    resenas: cuenta("resena"),
    tasa: visitas ? Math.round((whatsapp / visitas) * 1000) / 10 : null,
    fuentes: [...porFuente].map(([fuente, v]) => ({ fuente, visitas: v })).sort((a, b) => b.visitas - a.visitas),
  };
}

/** "▲ 20%" / "▼ 10%" / "=" contra la semana anterior; null si no hay con qué comparar. */
export function variacion(actual: number, anterior: number): string | null {
  if (anterior === 0) return actual > 0 ? "nuevo" : null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return "=";
  return pct > 0 ? `▲ ${pct}%` : `▼ ${Math.abs(pct)}%`;
}
