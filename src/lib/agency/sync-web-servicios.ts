/**
 * Mantiene el catálogo de servicios (`services`) igual a lo que publica la web
 * de la agencia: https://jdmedia.com.ar
 *
 * Por qué importa: desde que los prompts de prospección leen este catálogo
 * (ver `lib/prospecting/catalogo.ts`), lo que dice esta tabla es literalmente
 * lo que la IA le ofrece a un prospecto. Si en la web se agrega un servicio y
 * acá no, lo dejamos de vender; si se saca uno y acá queda, lo prometemos sin
 * tenerlo — que es justo el problema que se arregló el 2026-08-05.
 *
 * REGLA DE SEGURIDAD: agrega y actualiza, NUNCA borra ni desactiva.
 * `services.slug` lo referencian los servicios contratados de cada cliente. Un
 * fallo de red o un rediseño de la web no puede vaciar el catálogo. Lo que
 * desaparece de la web se marca `no_en_web` y lo decide una persona.
 */

import { fetchUrlContent } from "@/lib/url-fetch";

const HOME = "https://jdmedia.com.ar";

/**
 * Los slugs de la app están atados a los servicios contratados de cada cliente
 * (`client_services.tipo`), así que NO se pueden renombrar para que coincidan
 * con la URL de la web. Este mapa traduce.
 */
export const ALIAS_WEB_A_SLUG: Record<string, string> = {
  "gestion-redes": "gestion_redes",
  "publicidad-online": "paid_media",
  "diseno-grafico": "diseno_grafico",
  "produccion-contenido": "produccion_contenido",
  "desarrollo-web": "desarrollo_web",
  botly: "botly",
};

export interface ServicioWeb {
  /** Slug tal como aparece en la URL de la web. */
  slugWeb: string;
  /** Slug con el que vive en la app (traducido por el alias si existe). */
  slug: string;
  nombre: string;
  descripcion: string | null;
  url: string;
}

/** Convierte el último tramo de la URL en un slug de app razonable. */
export function slugDesdeUrl(url: string): string | null {
  const m = url.match(/\/servicios\/([^/?#]+)/i);
  if (!m) return null;
  return m[1].toLowerCase();
}

export function slugDeApp(slugWeb: string): string {
  return ALIAS_WEB_A_SLUG[slugWeb] ?? slugWeb.replace(/-/g, "_");
}

/** Saca las URLs de servicio del HTML del home, sin repetir y en orden. */
export function extraerUrlsDeServicios(html: string): string[] {
  const encontrados: string[] = [];
  const vistos = new Set<string>();
  const re = /href\s*=\s*["']([^"']*\/servicios\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    if (href.startsWith("/")) href = `${HOME}${href}`;
    if (!href.startsWith("http")) continue;
    // La landing general /servicios/ no es un servicio.
    const slug = slugDesdeUrl(href);
    if (!slug) continue;
    // Normalizamos la barra final para no traer la misma página dos veces.
    const limpia = href.replace(/([^:]\/)\/+/g, "$1").replace(/\/?$/, "/");
    if (vistos.has(limpia)) continue;
    vistos.add(limpia);
    encontrados.push(limpia);
  }
  return encontrados;
}

/**
 * De la página de un servicio saca el nombre y la descripción.
 *
 * Preferimos la `<meta name="description">`: es la frase que la agencia
 * escribió para describir el servicio y la que mejor funciona como contexto
 * para los prompts. El `<title>` da el nombre.
 */
export function parsearPaginaServicio(
  html: string,
  url: string
): { nombre: string; descripcion: string | null } | null {
  const metaRe =
    /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i;
  const metaRe2 =
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']description["']/i;
  const descripcion =
    html.match(metaRe)?.[1]?.trim() ?? html.match(metaRe2)?.[1]?.trim() ?? null;

  const titleRaw = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  // Los títulos vienen tipo "Gestión de Redes Sociales en Córdoba | JD MEDIA".
  let nombre = titleRaw
    .split(/[|·—]/)[0]
    .replace(/\s+en\s+córdoba\s*$/i, "")
    .trim();

  if (!nombre) {
    const slug = slugDesdeUrl(url);
    if (!slug) return null;
    nombre = slug.replace(/-/g, " ");
  }
  // "GESTIÓN DE REDES" -> "Gestión de redes": el catálogo se lee en la app y
  // entra en prompts; las mayúsculas de la web son decisión de diseño.
  if (nombre === nombre.toUpperCase()) {
    nombre = nombre.charAt(0) + nombre.slice(1).toLowerCase();
  }

  return { nombre, descripcion: descripcion?.slice(0, 600) ?? null };
}

/** Lee la web y devuelve los servicios que publica hoy. */
export async function leerServiciosDeLaWeb(): Promise<ServicioWeb[]> {
  const home = await fetchUrlContent(HOME);
  if (!home.ok || !home.text) {
    throw new Error(`No se pudo leer ${HOME}: ${home.error ?? "sin contenido"}`);
  }

  // fetchUrlContent devuelve texto plano; para los href necesitamos el HTML.
  const res = await fetch(HOME, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jdmedia.com.ar)",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`El home respondió HTTP ${res.status}.`);
  const html = await res.text();

  const urls = extraerUrlsDeServicios(html);
  if (urls.length === 0) {
    // Guarda dura: si el home cambió y no encontramos nada, no seguimos. Con 0
    // servicios cualquier lógica de "lo que no está, marcarlo" sería un desastre.
    throw new Error(
      "El home no listó ningún servicio. Puede que haya cambiado el diseño de la web: no se tocó el catálogo."
    );
  }

  const out: ServicioWeb[] = [];
  for (const url of urls) {
    const slugWeb = slugDesdeUrl(url);
    if (!slugWeb) continue;
    try {
      const r = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jdmedia.com.ar)",
        },
        redirect: "follow",
      });
      if (!r.ok) continue;
      const parsed = parsearPaginaServicio(await r.text(), url);
      if (!parsed) continue;
      out.push({
        slugWeb,
        slug: slugDeApp(slugWeb),
        nombre: parsed.nombre,
        descripcion: parsed.descripcion,
        url,
      });
    } catch {
      // Una página caída no invalida la corrida entera.
      continue;
    }
  }
  return out;
}

export interface ServicioApp {
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface PlanDeCambios {
  crear: ServicioWeb[];
  actualizar: { slug: string; nombre: string; descripcion: string | null; antes: ServicioApp }[];
  sinCambios: string[];
  /** En la app pero ya no en la web: se marcan, NO se borran. */
  noEnWeb: string[];
}

/**
 * Compara lo que hay en la app contra lo que publica la web.
 * Puro: se testea sin red ni base.
 */
export function planificarSync(
  enApp: ServicioApp[],
  enWeb: ServicioWeb[]
): PlanDeCambios {
  const porSlug = new Map(enApp.map((s) => [s.slug, s]));
  const slugsWeb = new Set(enWeb.map((s) => s.slug));

  const crear: ServicioWeb[] = [];
  const actualizar: PlanDeCambios["actualizar"] = [];
  const sinCambios: string[] = [];

  for (const w of enWeb) {
    const actual = porSlug.get(w.slug);
    if (!actual) {
      crear.push(w);
      continue;
    }
    const cambioNombre = actual.name !== w.nombre;
    // Si la web no trae descripción, nos quedamos con la que ya teníamos: es
    // mejor una descripción vieja que ninguna.
    const descNueva = w.descripcion ?? actual.description;
    const cambioDesc = (actual.description ?? null) !== (descNueva ?? null);
    if (cambioNombre || cambioDesc) {
      actualizar.push({
        slug: w.slug,
        nombre: w.nombre,
        descripcion: descNueva,
        antes: actual,
      });
    } else {
      sinCambios.push(w.slug);
    }
  }

  const noEnWeb = enApp.filter((s) => s.active && !slugsWeb.has(s.slug)).map((s) => s.slug);

  return { crear, actualizar, sinCambios, noEnWeb };
}
