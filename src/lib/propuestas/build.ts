/**
 * Armado de la propuesta comercial. Puro: recibe el catálogo (que sale de la
 * base y se sincroniza solo con jdmedia.com.ar) y devuelve lo que se pinta.
 *
 * Dos reglas que vienen de decisiones ya tomadas:
 *  - Los PRECIOS van visibles. Ya están publicados en la web, así que
 *    esconderlos no protege nada y deja sin responder justo lo que el prospecto
 *    preguntó.
 *  - Nunca se promete nada que la agencia no venda: los servicios salen de la
 *    tabla `services`, igual que en prospección (ver lib/prospecting/catalogo).
 */

import { rubroPorSlug, type PackSlug, type RubroPropuesta } from "./rubros";

export interface ServicioCatalogo {
  slug: string;
  name: string;
  description: string | null;
  web_url?: string | null;
}

export interface PackCatalogo {
  slug: string;
  nombre: string;
  precio_mensual: number | null;
  descripcion: string | null;
  reels: number | null;
  posts: number | null;
  dias_historias: number | null;
  orden?: number | null;
}

/** El bloque que escribe la IA cuando se le pasa lo que dijo el prospecto. */
export interface BloqueIa {
  titular?: string | null;
  diagnostico?: string | null;
  puntos?: string[] | null;
  generado_at?: string | null;
}

export interface PropuestaVista {
  empresa: string;
  contactoNombre: string | null;
  rubro: RubroPropuesta;
  /** Titular de portada (lo pisa la IA si se usó). */
  titular: string;
  /** Diagnóstico del rubro (lo pisa la IA si se usó). */
  diagnostico: string;
  /** Cuando la IA respondió a algo puntual que dijo el prospecto. */
  puntosIa: string[];
  /** true si el texto de arriba lo escribió la IA para este prospecto. */
  personalizada: boolean;
  ideas: string[];
  /** Servicios ordenados: primero los que le sirven a este rubro. */
  servicios: ServicioCatalogo[];
  /** Los servicios sugeridos, ya resueltos contra el catálogo. */
  sugeridos: ServicioCatalogo[];
  packs: PackCatalogo[];
  packRecomendado: PackCatalogo | null;
  experiencia: string | null;
}

export interface ArmarPropuestaInput {
  empresa: string;
  contactoNombre?: string | null;
  rubroSlug?: string | null;
  packSugerido?: string | null;
  /** Slugs elegidos a mano; si no vienen, se usan los del rubro. */
  servicios?: string[] | null;
  catalogo: ServicioCatalogo[];
  packs: PackCatalogo[];
  ia?: BloqueIa | null;
}

/** Los packs se muestran en el orden de la web (Presencia → Escala). */
function ordenarPacks(packs: PackCatalogo[]): PackCatalogo[] {
  return [...packs].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
}

export function armarPropuesta(input: ArmarPropuestaInput): PropuestaVista {
  const rubro = rubroPorSlug(input.rubroSlug);
  const porSlug = new Map(input.catalogo.map((s) => [s.slug, s]));

  const slugsSugeridos = (input.servicios?.length ? input.servicios : rubro.servicios).filter(
    (s) => porSlug.has(s),
  );
  const sugeridos = slugsSugeridos.map((s) => porSlug.get(s)!);
  // El resto del catálogo va después: que vea todo lo que la agencia hace, pero
  // sin que compita con lo que le estamos recomendando.
  const resto = input.catalogo.filter((s) => !slugsSugeridos.includes(s.slug));

  const packs = ordenarPacks(input.packs);
  const packSlug = (input.packSugerido ?? rubro.pack) as PackSlug;
  const packRecomendado = packs.find((p) => p.slug === packSlug) ?? packs[0] ?? null;

  const ia = input.ia ?? null;
  const puntosIa = (ia?.puntos ?? []).filter((p) => p && p.trim().length > 0);
  const personalizada = !!(ia?.diagnostico?.trim() || puntosIa.length > 0);

  return {
    empresa: input.empresa.trim(),
    contactoNombre: input.contactoNombre?.trim() || null,
    rubro,
    titular: ia?.titular?.trim() || rubro.titular,
    diagnostico: ia?.diagnostico?.trim() || rubro.diagnostico,
    puntosIa,
    personalizada,
    ideas: rubro.ideas,
    servicios: [...sugeridos, ...resto],
    sugeridos,
    packs,
    packRecomendado,
    experiencia: rubro.experiencia ?? null,
  };
}

/** $400.000 — mismo formato que el resto de la app. */
export function precioAr(n: number | null | undefined): string {
  if (n == null) return "A medida";
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Lo que arma el pack en un mes, en una línea legible.
 * Devuelve null para "Personalizado", que no tiene volúmenes fijos.
 */
export function volumenPack(p: PackCatalogo): string | null {
  const partes: string[] = [];
  if (p.reels) partes.push(`${p.reels} reels`);
  if (p.posts) partes.push(`${p.posts} posts o carruseles`);
  if (p.dias_historias) partes.push(`historias ${p.dias_historias} días del mes`);
  return partes.length ? partes.join(" · ") : null;
}

/** Texto del botón de WhatsApp de la propuesta (lo manda el prospecto). */
export function mensajeWhatsapp(empresa: string): string {
  return `Hola! Soy de ${empresa}. Vi la propuesta y quiero coordinar una reunión.`;
}

/** El link que se copia y se manda por WhatsApp. */
export function urlPropuesta(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/propuesta/${token}`;
}

/**
 * Token de la URL. Corto para que el link no asuste en WhatsApp, pero con
 * suficiente azar como para que nadie caiga en la propuesta de otro.
 */
export function nuevoToken(random: () => number = Math.random): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789"; // sin l/o/0/1: se confunden
  let out = "";
  for (let i = 0; i < 14; i++) out += abc[Math.floor(random() * abc.length)];
  return out;
}
