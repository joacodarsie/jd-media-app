/**
 * Detección y extracción de contenido textual de URLs incluidas en un mensaje.
 * Pensado para inyectar el texto de la URL como contexto en el chat IA.
 */

const URL_RE = /https?:\/\/[^\s<>"]+/gi;
const MAX_URLS = 3;
const MAX_BYTES = 50_000;
const FETCH_TIMEOUT_MS = 6_000;

export interface FetchedUrl {
  url: string;
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

export function extractUrls(input: string): string[] {
  const found = new Set<string>();
  for (const m of input.match(URL_RE) ?? []) {
    found.add(m.replace(/[).,;:!?]+$/, ""));
    if (found.size >= MAX_URLS) break;
  }
  return Array.from(found);
}

function htmlToText(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  let body = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(?:br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES) + "\n…(truncado)";
  return { title, text: body };
}

export async function fetchUrlContent(url: string): Promise<FetchedUrl> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JDMediaBot/1.0; +https://jdmedia.com.ar)",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) {
      return { url, ok: false, error: `HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    if (/text\/html|application\/xhtml/i.test(ct)) {
      const { title, text } = htmlToText(raw);
      return { url, ok: true, title, text };
    }
    if (/text\/|application\/json|application\/xml/i.test(ct)) {
      return {
        url,
        ok: true,
        text: raw.slice(0, MAX_BYTES) + (raw.length > MAX_BYTES ? "\n…(truncado)" : ""),
      };
    }
    return { url, ok: false, error: `tipo no soportado: ${ct}` };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchAllUrls(text: string): Promise<FetchedUrl[]> {
  const urls = extractUrls(text);
  if (urls.length === 0) return [];
  return Promise.all(urls.map(fetchUrlContent));
}
