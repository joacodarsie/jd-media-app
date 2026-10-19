/**
 * Referencias de inspo automáticas (19/10/2026, pedido del dueño: «que la IA
 * detecte cuentas inspiracionales buenas para cada cuenta, porque nadie se
 * toma el trabajo de cargarlas»). Lo puro: sacar los @ que nombró el cliente
 * y elegir las mejores candidatas YA VERIFICADAS contra Instagram (la IA puede
 * inventar usuarios: lo que no existe o no es de empresa, se descarta).
 */
import { mediana } from "./inspo";

/** Los @usuario que aparecen en un texto (transcripción, notas), sin mails. */
export function handlesDelTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const out = new Set<string>();
  for (const m of texto.matchAll(/(^|[^\w@.])@([a-zA-Z0-9._]{3,30})/g)) {
    const h = m[2].replace(/\.+$/, "").toLowerCase();
    if (h.length >= 3 && !/^\d+$/.test(h)) out.add(h);
  }
  return [...out];
}

export interface Candidata {
  usuario: string;
  seguidores: number;
  /** Publicaciones con fecha, para ver si está activa. */
  media: { timestamp?: string | null; like_count?: number | null; comments_count?: number | null }[];
}

/** Interacción típica por seguidor (mediana de likes + 2 × comentarios / seguidores). */
export function tasaDeInteraccion(c: Candidata): number {
  if (!c.seguidores) return 0;
  const xs = c.media.map((m) => (m.like_count ?? 0) + 2 * (m.comments_count ?? 0));
  return mediana(xs) / c.seguidores;
}

/**
 * Las que valen la pena: activas (publicaron en los últimos 60 días), con
 * público (1.000+ seguidores) y la mejor interacción primero.
 */
export function elegirCandidatas(cs: Candidata[], ahora: number, max = 5): Candidata[] {
  return cs
    .filter((c) => c.seguidores >= 1000 && c.media.some((m) => m.timestamp && ahora - Date.parse(m.timestamp) <= 60 * 86_400_000))
    .sort((a, b) => tasaDeInteraccion(b) - tasaDeInteraccion(a))
    .slice(0, max);
}

/** El pedido a la IA: usuarios reales del rubro, locales y de afuera. */
export function promptReferencias(c: { nombre: string; rubro: string | null; notas: string | null; ig: string | null; contexto: string | null }): string {
  return [
    `Necesito cuentas de Instagram que sirvan de inspiración de contenido para la marca «${c.nombre}»${c.rubro ? `, del rubro ${c.rubro}` : ""}${c.ig ? ` (su cuenta es @${c.ig})` : ""}. Es una marca de Córdoba, Argentina.`,
    c.notas ? `Notas de la cuenta: ${c.notas.slice(0, 600)}` : "",
    c.contexto ? `Lo que contó el cliente en su reunión de diagnóstico (extracto): ${c.contexto.slice(0, 2500)}` : "",
    "",
    "Dame 20 cuentas REALES y conocidas de Instagram que comuniquen muy bien en ese rubro o en uno parecido: competidores argentinos que lo hacen bien, marcas latinoamericanas o de España del mismo rubro, y referentes internacionales. Tienen que ser cuentas de empresa o creador, públicas y activas. No inventes: si no estás seguro de que un usuario existe tal cual, no lo pongas.",
    "",
    'Respondé SOLO con un JSON así, sin texto alrededor: {"cuentas": ["usuario1", "usuario2"]} (los usuarios sin @).',
  ]
    .filter(Boolean)
    .join("\n");
}

export function leerRespuestaIA(texto: string): string[] {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]) as { cuentas?: unknown };
    return Array.isArray(j.cuentas)
      ? j.cuentas.filter((x): x is string => typeof x === "string").map((x) => x.replace(/^@/, "").trim().toLowerCase()).filter((x) => /^[a-z0-9._]{2,30}$/.test(x))
      : [];
  } catch {
    return [];
  }
}
