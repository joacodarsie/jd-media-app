/**
 * Constantes y helpers de Prospección, compartidos entre server y client.
 * Sin imports de servidor (se usa también en componentes "use client").
 */

export const PROSPECTING_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram (DM)" },
  { value: "email", label: "Email" },
] as const;

export const PROSPECTING_LANGS = [
  { value: "es_ar", label: "Español (Argentina)" },
  { value: "es", label: "Español (neutro / España)" },
  { value: "en", label: "Inglés" },
] as const;

export const LEAD_ESTADOS = [
  { value: "nuevo", label: "Nuevo", badge: "bg-slate-200 text-slate-700 dark:bg-slate-500/40 dark:text-slate-100" },
  { value: "contactado", label: "Contactado", badge: "bg-blue-200 text-blue-800 dark:bg-blue-500/40 dark:text-blue-100" },
  { value: "respondio", label: "Respondió", badge: "bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100" },
  { value: "reunion", label: "Reunión", badge: "bg-violet-200 text-violet-900 dark:bg-violet-500/40 dark:text-violet-100" },
  { value: "ganado", label: "Ganado", badge: "bg-emerald-600 text-white dark:bg-emerald-500" },
  { value: "descartado", label: "Descartado", badge: "bg-rose-200 text-rose-900 dark:bg-rose-500/40 dark:text-rose-100" },
] as const;

export type LeadEstado = (typeof LEAD_ESTADOS)[number]["value"];

export const channelLabel = (v: string) =>
  PROSPECTING_CHANNELS.find((c) => c.value === v)?.label ?? v;
export const langLabel = (v: string) =>
  PROSPECTING_LANGS.find((c) => c.value === v)?.label ?? v;
export const estadoMeta = (v: string) =>
  LEAD_ESTADOS.find((e) => e.value === v) ?? LEAD_ESTADOS[0];

/**
 * Link wa.me con el mensaje pre-cargado. A diferencia del helper de cobros, NO
 * fuerza el código de Argentina: los leads pueden ser de cualquier país, así que
 * usa el número tal como vino (se espera formato internacional). Devuelve null si
 * no hay un número usable.
 */
export function intlWhatsappLink(
  telefono: string | null | undefined,
  mensaje: string
): string | null {
  if (!telefono) return null;
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}

/** Normaliza un handle/URL de Instagram a una URL abrible. */
export function instagramUrl(ig: string | null | undefined): string | null {
  if (!ig) return null;
  const v = ig.trim();
  if (!v) return null;
  if (v.startsWith("http")) return v;
  const handle = v.replace(/^@/, "").replace(/\s+/g, "");
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

/** Asegura que una URL tenga esquema (para href). */
export function ensureHttp(url: string | null | undefined): string | null {
  if (!url) return null;
  const v = url.trim();
  if (!v) return null;
  return v.startsWith("http") ? v : `https://${v}`;
}
