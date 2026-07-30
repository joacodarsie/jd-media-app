/**
 * Saca la dirección de email de un negocio a partir de su sitio web.
 *
 * Por qué existe: para el email en frío hace falta la dirección, y Google Places
 * NO la devuelve (devuelve el sitio). Bajar el HTML y leer los mails que la
 * empresa publica es gratis y no gasta tokens — no hay modelo en el medio.
 *
 * La parte que decide (limpiar, filtrar basura y elegir la mejor) es pura para
 * poder testearla; lo único con red es `buscarEmailDeSitio`.
 */

/** Extensiones de archivo que el regex confunde con un mail (logo@2x.png). */
const EXT_ARCHIVO = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico|mp4|pdf)$/i;

/**
 * Dominios de servicios que aparecen en el HTML y NO son de la empresa
 * (herramientas, tracking, plantillas). Escribirles no sirve para nada.
 */
const DOMINIOS_BASURA = [
  "example.com",
  "example.org",
  "domain.com",
  "email.com",
  "tudominio.com",
  "sentry.io",
  "sentry-next.wixpress.com",
  "wixpress.com",
  "wix.com",
  "godaddy.com",
  "squarespace.com",
  "shopify.com",
  "wordpress.com",
  "wordpress.org",
  "jimdo.com",
  "weebly.com",
  "tiendanube.com",
  "mercadolibre.com",
  "google.com",
  "gstatic.com",
  "schema.org",
  "w3.org",
  "adobe.com",
  "facebook.com",
  "instagram.com",
  "whatsapp.com",
  "sentry.wixpress.com",
];

/** Buzones que no lee una persona: escribirles es tirar el envío. */
const PREFIJOS_NO_HUMANOS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
  "abuse",
  "privacy",
  "dmca",
  "webmaster",
  "hostmaster",
  "sentry",
];

/** Buzones que sí lee alguien que puede comprar. Cuanto más arriba, mejor. */
const PREFIJOS_BUENOS = [
  "comercial",
  "ventas",
  "contacto",
  "info",
  "hola",
  "consultas",
  "administracion",
  "marketing",
  "gerencia",
];

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Dominio de una URL, sin www. Devuelve "" si no se puede leer. */
export function dominioDe(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function esUsable(email: string): boolean {
  if (EXT_ARCHIVO.test(email)) return false;
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return false;
  if (dominio.length < 4 || !dominio.includes(".")) return false;
  if (DOMINIOS_BASURA.some((d) => dominio === d || dominio.endsWith(`.${d}`))) return false;
  if (PREFIJOS_NO_HUMANOS.some((p) => usuario.startsWith(p))) return false;
  // Hashes de tracking: "a3f9c1e2b4d5...@algo" no es un mail de contacto.
  if (/^[0-9a-f]{16,}$/i.test(usuario)) return false;
  return true;
}

/**
 * Qué tan bueno es el mail para escribirle (más alto = mejor).
 * El del propio dominio del sitio gana siempre: un gmail suelto en el HTML
 * suele ser del que hizo la página, no del dueño del negocio.
 */
function puntaje(email: string, dominioSitio: string): number {
  const [usuario, dominio] = email.split("@");
  let p = 0;
  if (dominioSitio && (dominio === dominioSitio || dominio.endsWith(`.${dominioSitio}`))) p += 100;
  const idx = PREFIJOS_BUENOS.findIndex((b) => usuario.startsWith(b));
  if (idx >= 0) p += 50 - idx * 2;
  // Un mail personal (juan.perez@) es mejor que uno genérico de otro dominio.
  if (usuario.includes(".")) p += 5;
  return p;
}

/**
 * Todos los mails aprovechables del HTML, del mejor al peor.
 * `sitioUrl` se usa para preferir los del dominio propio del negocio.
 */
export function extraerEmails(html: string, sitioUrl = ""): string[] {
  const dominioSitio = dominioDe(sitioUrl);
  const crudos = html.match(RE_EMAIL) ?? [];
  const vistos = new Map<string, number>();
  for (const crudo of crudos) {
    const email = crudo.toLowerCase().replace(/\.$/, "");
    if (!esUsable(email)) continue;
    if (!vistos.has(email)) vistos.set(email, puntaje(email, dominioSitio));
  }
  return [...vistos.entries()].sort((a, b) => b[1] - a[1]).map(([email]) => email);
}

/** Páginas donde las empresas suelen poner el mail, en orden de probabilidad. */
const RUTAS_CONTACTO = ["", "/contacto", "/contact", "/contactanos", "/nosotros"];

/**
 * Baja el sitio y devuelve el mejor email que encuentre, o null.
 * Corta apenas encuentra uno: cada página de más es tiempo del cron.
 */
export async function buscarEmailDeSitio(
  sitioUrl: string,
  opts: { timeoutMs?: number } = {}
): Promise<string | null> {
  const base = sitioUrl.startsWith("http") ? sitioUrl : `https://${sitioUrl}`;
  let origen: string;
  try {
    origen = new URL(base).origin;
  } catch {
    return null;
  }

  for (const ruta of RUTAS_CONTACTO) {
    const url = ruta ? `${origen}${ruta}` : base;
    const html = await bajarHtml(url, opts.timeoutMs ?? 8000);
    if (!html) continue;
    const encontrados = extraerEmails(html, origen);
    if (encontrados.length) return encontrados[0];
  }
  return null;
}

async function bajarHtml(url: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // Sin user agent de navegador muchos sitios devuelven 403.
        "User-Agent":
          "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jd-media-app.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) return null;
    // Tope de 600kB: alcanza de sobra para el pie de página, donde vive el mail.
    return (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
