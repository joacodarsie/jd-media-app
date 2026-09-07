/**
 * Lee el sitio (y, si se puede, el Instagram) del prospecto para darle contexto
 * REAL a la propuesta.
 *
 * Por qué existe: antes al modelo se le pasaba la URL como texto y no sirve de
 * nada — no puede abrirla. Con el contenido del sitio adentro del prompt, la
 * propuesta habla de lo que el negocio vende de verdad en vez de generalidades
 * del rubro.
 *
 * Best-effort de punta a punta: si el sitio no responde, tarda o bloquea, la
 * propuesta se genera igual con lo que haya. Nunca tira abajo la generación.
 */

const TIMEOUT_MS = 8000;
/** Con esto alcanza para saber qué vende y cómo se presenta. */
const MAX_TEXTO = 6000;

function normalizarUrl(u: string): string | null {
  const limpio = u.trim();
  if (!limpio) return null;
  const conProtocolo = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
  try {
    const url = new URL(conProtocolo);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Entidades con nombre más comunes en sitios en español. Las numéricas
 * (`&#8211;`, `&#xE9;`) se resuelven aparte, que son las que más aparecen en
 * los títulos de WordPress.
 */
const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iquest: "¿",
  iexcl: "¡",
  ordm: "º",
  ordf: "ª",
  deg: "°",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  euro: "€",
  trade: "™",
  reg: "®",
  copy: "©",
};

/** Traduce entidades HTML a caracteres de verdad. */
export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, nombre) => ENTIDADES[nombre] ?? m);
}

/** HTML → texto legible: sin scripts, sin estilos, sin etiquetas ni espacios de más. */
export function htmlATexto(html: string): string {
  const sinMarcado = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodificarEntidades(sinMarcado).replace(/\s+/g, " ").trim();
}

/** El título y la descripción, que suelen decir en una línea a qué se dedican. */
export function metaDelSitio(html: string): { titulo: string | null; descripcion: string | null } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const d =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html);
  return {
    titulo: t ? htmlATexto(t[1]).slice(0, 200) || null : null,
    descripcion: d ? htmlATexto(d[1]).slice(0, 400) || null : null,
  };
}

export interface ContextoWeb {
  url: string;
  titulo: string | null;
  descripcion: string | null;
  texto: string;
}

/** Baja la home y devuelve lo que se pueda leer. null si no se pudo. */
export async function leerSitio(sitio: string | null | undefined): Promise<ContextoWeb | null> {
  const url = normalizarUrl(sitio ?? "");
  if (!url) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // Sin user agent de navegador muchos sitios devuelven 403.
        "User-Agent":
          "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jdmedia.com.ar)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
    const html = (await res.text()).slice(0, 600_000);
    const { titulo, descripcion } = metaDelSitio(html);
    const texto = htmlATexto(html).slice(0, MAX_TEXTO);
    if (!texto && !titulo) return null;
    return { url, titulo, descripcion, texto };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * El bloque que se pega en el prompt.
 *
 * ⚠️ Instagram NO se puede leer: exige sesión y devuelve una página vacía a
 * cualquier bot. Se pasa el handle igual —sirve para nombrarlo— pero se le
 * aclara al modelo que no lo vio, para que no invente lo que "se ve" en el
 * perfil. Si hace falta el contenido del perfil, la vía es subir una captura.
 */
export function bloqueDeContextoWeb(web: ContextoWeb | null, instagram: string | null): string {
  const partes: string[] = [];
  if (web) {
    partes.push(
      `\n=== Sitio del prospecto (${web.url}) — leído por nosotros, es información real ===`,
      web.titulo ? `Título: ${web.titulo}` : "",
      web.descripcion ? `Descripción: ${web.descripcion}` : "",
      `Contenido: """${web.texto}"""`,
    );
  }
  if (instagram?.trim()) {
    partes.push(
      `\nInstagram del prospecto: ${instagram.trim()} (NO pudimos verlo: Instagram no deja leer perfiles sin sesión. Mencionalo solo si hace falta, y no describas lo que "se ve" en el perfil porque no lo sabemos).`,
    );
  }
  return partes.filter(Boolean).join("\n");
}
