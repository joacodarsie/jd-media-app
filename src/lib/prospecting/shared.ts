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

/**
 * Dónde sale a buscar el extractor de contactos. Cada fuente cambia la
 * estrategia de búsqueda (y qué datos llegan completos): Maps trae teléfonos,
 * LinkedIn trae nombre + cargo del decisor, "demanda" trae los de mayor
 * intención de compra (los que ya están buscando el servicio).
 */
export const PROSPECTING_FUENTES = [
  { value: "mix", label: "En todos lados ⭐", hint: "Combina Maps, Google, LinkedIn e Instagram y se queda con los mejores prospectos de cada uno. La opción por defecto." },
  { value: "maps", label: "Google Maps / local", hint: "Negocios con dirección. La que más teléfonos trae." },
  { value: "google", label: "Google / directorios", hint: "Sitios oficiales, guías y rankings del rubro." },
  { value: "linkedin", label: "LinkedIn", hint: "Empresas y decisores B2B: trae nombre y cargo, rara vez teléfono." },
  { value: "instagram", label: "Instagram", hint: "Cuentas del rubro con presencia floja. Tel. si está en la bio." },
  { value: "demanda", label: "Ya buscan el servicio ⚡", hint: "Empresas buscando CM, diseñador, editor o publicidad. La de mayor intención de compra." },
] as const;

export type ProspectingFuente = (typeof PROSPECTING_FUENTES)[number]["value"];
export const FUENTES_OK = PROSPECTING_FUENTES.map((f) => f.value) as readonly string[];

export const LEAD_ESTADOS = [
  // Misma paleta suave que CONTACTO_ESTADOS (ver nota abajo): en modo noche los
  // fondos saturados quedaban chillones.
  { value: "nuevo", label: "Nuevo", badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { value: "contactado", label: "Contactado", badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { value: "respondio", label: "Respondió", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "reunion", label: "Reunión", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  // "Ganado" queda sólido a propósito: es el único estado que celebra.
  { value: "ganado", label: "Ganado", badge: "bg-emerald-600 text-white dark:bg-emerald-500" },
  { value: "descartado", label: "Descartado", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
] as const;

export type LeadEstado = (typeof LEAD_ESTADOS)[number]["value"];

/**
 * Estados de la tabla "Contactos (modo rápido)" — más simple que el pipeline de
 * leads: solo para clasificar a mano a quién ya escribiste y cómo viene.
 */
export const CONTACTO_ESTADOS = [
  // Fondos suaves + texto del mismo tono: en modo noche los fondos saturados
  // (bg-*-200 / *-500/40) quedaban como parches chillones, sobre todo en los
  // <select> nativos de la tabla de contactos.
  { value: "nuevo", label: "Sin contactar", badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { value: "contactado", label: "Contactado", badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { value: "interesado", label: "Interesado", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  // La reunión es el paso que decide todo: es la perilla que medimos en el
  // tablero de la máquina de clientes (% de contactados que agenda).
  { value: "reunion", label: "Reunión agendada", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  { value: "descartado", label: "No / Descartado", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
] as const;

export type ContactoEstado = (typeof CONTACTO_ESTADOS)[number]["value"];
export const contactoEstadoMeta = (v: string) =>
  CONTACTO_ESTADOS.find((e) => e.value === v) ?? CONTACTO_ESTADOS[0];

/** Días que esperamos antes de sugerir un seguimiento a un lead sin respuesta. */
export const SEGUIMIENTO_DIAS = 3;

// ── Mensajes de la campaña ──────────────────────────────────────────────────

/**
 * Los cuatro bloques que genera la IA para cada campaña. El orden es el de la
 * tarjeta y también el de respaldo para elegir cuál se usa en Contactos.
 */
export const MENSAJE_BLOQUES = [
  { key: "primer_mensaje", label: "Primer mensaje" },
  { key: "alternativa", label: "Alternativa (otro ángulo)" },
  { key: "seguimiento_1", label: "Seguimiento 1" },
  { key: "seguimiento_2", label: "Seguimiento 2" },
] as const;

export type MensajeBloqueKey = (typeof MENSAJE_BLOQUES)[number]["key"];

export interface CampaignMessages {
  primer_mensaje: string;
  alternativa: string;
  seguimiento_1: string;
  seguimiento_2: string;
  /**
   * Cuál de los cuatro se usa al escribirle a un contacto (copiar, WhatsApp y
   * despacho). Si no está, se usa el primero. Vive en el mismo jsonb, así que
   * no hace falta migración.
   */
  elegido?: MensajeBloqueKey;
}

export const bloqueLabel = (k: MensajeBloqueKey): string =>
  MENSAJE_BLOQUES.find((b) => b.key === k)?.label ?? k;

/**
 * Mensaje que hay que usar para escribirle a un contacto: el elegido a mano, o
 * el primero que tenga texto. Devuelve null si la campaña no tiene plantilla.
 */
export function mensajeElegido(
  tpl: CampaignMessages | null | undefined
): { key: MensajeBloqueKey; label: string; texto: string } | null {
  if (!tpl) return null;
  const preferido = tpl.elegido;
  const orden: MensajeBloqueKey[] = preferido
    ? [preferido, ...MENSAJE_BLOQUES.map((b) => b.key).filter((k) => k !== preferido)]
    : MENSAJE_BLOQUES.map((b) => b.key);
  for (const key of orden) {
    const texto = tpl[key];
    if (typeof texto === "string" && texto.trim())
      return { key, label: bloqueLabel(key), texto };
  }
  return null;
}

/**
 * Reemplaza los huecos del mensaje con los datos del contacto. Si no hay
 * persona, saca el saludo con nombre para que no quede "Hola [NOMBRE]".
 */
export function personalizarMensaje(
  plantilla: string,
  datos: { empresa: string; contacto?: string | null }
): string {
  const m = plantilla.replaceAll("[EMPRESA]", datos.empresa);
  const persona = datos.contacto?.trim().split(/\s+/)[0];
  return persona
    ? m.replaceAll("[NOMBRE]", persona)
    : // Sin persona: "Hola [NOMBRE], ¿cómo estás?" → "Hola, ¿cómo estás?"
      m.replaceAll(/\s*\[NOMBRE\]/g, "");
}

/**
 * Embudo de una campaña a partir de los estados de sus leads. "Contactados" son
 * los que ya recibieron al menos el primer mensaje (de ahí en adelante).
 */
export function leadStats(estados: string[]) {
  const contactados = estados.filter((e) =>
    ["contactado", "respondio", "reunion", "ganado"].includes(e)
  ).length;
  const respondieron = estados.filter((e) =>
    ["respondio", "reunion", "ganado"].includes(e)
  ).length;
  const ganados = estados.filter((e) => e === "ganado").length;
  return {
    contactados,
    respondieron,
    ganados,
    tasaRespuesta: contactados ? Math.round((respondieron / contactados) * 100) : null,
    tasaConversion: contactados ? Math.round((ganados / contactados) * 100) : null,
  };
}

// `diasDesde` vive en @/lib/dates (fuente única). Se re-exporta acá para no
// romper los imports existentes de prospección.
export { diasDesde } from "@/lib/dates";

export const channelLabel = (v: string) =>
  PROSPECTING_CHANNELS.find((c) => c.value === v)?.label ?? v;
export const langLabel = (v: string) =>
  PROSPECTING_LANGS.find((c) => c.value === v)?.label ?? v;
export const estadoMeta = (v: string) =>
  LEAD_ESTADOS.find((e) => e.value === v) ?? LEAD_ESTADOS[0];

/**
 * Normaliza un teléfono a los dígitos que espera wa.me. El caso que rompía todo
 * es ARGENTINA: para WhatsApp los celulares van `54 9 <área> <número>` SIN el
 * "15" local. Los negocios publican "+54 351 15-331-9555" o "+54 351 331 9555",
 * y con esos dígitos tal cual wa.me abre un chat muerto. Acá:
 *  - se agrega el 9 si falta (54… → 549…)
 *  - se saca el "15" metido después del código de área (probamos áreas de 2 a 4
 *    dígitos; el número nacional correcto tiene 10 dígitos)
 * Otros países pasan tal cual. Exportada para testearla.
 */
export function waDigits(telefono: string): string | null {
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  // Sin código de país y con 0 adelante (formato local "0351 15…"): asumimos AR,
  // que es donde prospectamos por defecto.
  if (d.startsWith("0") && !d.startsWith("00")) d = "54" + d.slice(1);
  if (d.length < 8) return null;

  if (d.startsWith("54")) {
    let rest = d.slice(2);
    if (rest.startsWith("9")) rest = rest.slice(1);
    // Nacional correcto = 10 dígitos (área + abonado). Si sobran 2 y hay un "15"
    // después del área, es el prefijo local: se elimina.
    if (rest.length === 12) {
      for (const areaLen of [2, 3, 4]) {
        if (rest.slice(areaLen, areaLen + 2) === "15") {
          rest = rest.slice(0, areaLen) + rest.slice(areaLen + 2);
          break;
        }
      }
    }
    return "549" + rest;
  }
  return d;
}

/**
 * Códigos de área argentinos de 3 dígitos (capitales y ciudades grandes). El
 * resto se asume de 4, salvo el 11 que es de 2. Sirve para saber dónde termina
 * el área y empieza el número de abonado.
 */
const AREAS_3 = new Set([
  "220", "221", "223", "230", "236", "237", "249", "260", "261", "263", "264",
  "266", "280", "291", "297", "298", "299", "336", "341", "342", "343", "345",
  "348", "351", "353", "358", "362", "364", "370", "376", "379", "380", "381",
  "383", "385", "387", "388",
]);

/**
 * ¿El teléfono parece una línea FIJA argentina? Es una heurística, no una
 * certeza: en Argentina los abonados fijos arrancan con 4 (Córdoba 351-4xx,
 * CABA 11-4xxx) mientras que los celulares arrancan con 2, 3, 5, 6 o 7. Los
 * números marcados como móvil (con "15" local o "9" internacional) se descartan
 * de entrada.
 *
 * Por qué importa: un fijo pasado por `waDigits` genera un wa.me que abre un
 * chat MUERTO. Escribirle a 20 fijos parece que "los números están mal" cuando
 * en realidad nunca fueron de WhatsApp. Ojo: WhatsApp Business SÍ se puede
 * verificar sobre un fijo, así que esto avisa, no bloquea.
 */
export function esProbableFijoAr(telefono: string | null | undefined): boolean {
  if (!telefono) return false;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "54" + d.slice(1);
  if (!d.startsWith("54")) return false; // solo sabemos de Argentina
  const rest = d.slice(2);
  // Marcado como celular: el 9 internacional.
  if (rest.startsWith("9")) return false;
  const areaLen = rest.startsWith("11") ? 2 : AREAS_3.has(rest.slice(0, 3)) ? 3 : 4;
  // Marcado como celular: el "15" local justo después del área.
  if (rest.slice(areaLen, areaLen + 2) === "15") return false;
  const abonado = rest.slice(areaLen);
  if (abonado.length < 6) return false;
  return abonado.startsWith("4");
}

/**
 * Link wa.me con el mensaje pre-cargado. Normaliza el número con `waDigits`
 * (fix del 9 y el "15" argentinos). Devuelve null si no hay un número usable.
 */
export function intlWhatsappLink(
  telefono: string | null | undefined,
  mensaje: string
): string | null {
  if (!telefono) return null;
  const digits = waDigits(telefono);
  if (!digits) return null;
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
