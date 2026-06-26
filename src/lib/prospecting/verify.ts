/**
 * Verificación de los Instagram de los leads usando la BÚSQUEDA WEB de Claude.
 *
 * Problema que resuelve: en el descubrimiento la IA a veces arma el handle de IG
 * a partir del nombre de la empresa, y ese perfil no existe o está vacío. No se
 * puede chequear con un fetch porque Instagram bloquea los requests desde server
 * (sirve el muro de login a todos por igual). Pero los perfiles REALES están
 * indexados en los buscadores, así que la búsqueda web sí distingue: si el handle
 * no existe, buscarlo no devuelve ese perfil.
 *
 * Para cada empresa+handle, la IA confirma que el perfil existe y es de esa
 * empresa. Si el handle está mal, intenta encontrar el REAL y lo corrige. Si no
 * hay un Instagram real, devuelve null (mejor sin link que con un link muerto).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";

const client = new Anthropic();

export interface IgVerifyInput {
  empresa: string;
  instagram: string | null;
  sitio_web?: string | null;
  ciudad?: string | null;
  pais?: string | null;
}

export interface IgVerifyResult {
  empresa: string;
  /** Handle confirmado/corregido (sin @) o null si no hay un IG real. */
  instagram: string | null;
  /** true solo si la búsqueda confirmó que el perfil existe y es de la empresa. */
  verificado: boolean;
}

/** Normaliza a handle pelado (sin @, sin URL, sin / final) y en minúsculas. */
export function toHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, "").replace(/\/+$/, "").trim();
  if (!v || /^(p|reel|reels|explore|stories)$/i.test(v)) return null;
  return v.toLowerCase();
}

function buildSystem(idioma: string): string {
  return `Sos un verificador de cuentas de Instagram para un equipo de prospección comercial. Te paso una lista de empresas con un posible handle de Instagram (que puede estar mal o no existir). Tu trabajo es, para CADA empresa, confirmar con la búsqueda web si ese Instagram REALMENTE existe y es de esa empresa.

CÓMO VERIFICAR (obligatorio usar la búsqueda web, no adivines)
1. Buscá el perfil exacto: por ejemplo "instagram.com/<handle>", el nombre de la empresa + "instagram", o "<empresa> <ciudad> instagram".
2. El perfil cuenta como REAL solo si en los resultados aparece ESE perfil de Instagram y corresponde a esa empresa (mismo nombre/rubro/zona). Que el buscador devuelva el perfil con su título/descripción es buena señal de que existe.
3. Si el handle que te pasé NO aparece o lleva a otra cuenta distinta, está MAL. En ese caso buscá el Instagram REAL de la empresa y corregilo.
4. Si después de buscar no encontrás ningún Instagram real y activo de esa empresa, devolvé instagram = null. NUNCA devuelvas un handle inventado o "probable": es mejor null que un link muerto.

REGLAS DURAS
- PROHIBIDO marcar verificado=true sin haber visto el perfil en los resultados de búsqueda. Ante la duda, verificado=false.
- Devolvé el handle SIN @ y sin URL (solo el nombre de usuario, ej: "panaderia.lacentral").
- Una empresa por entrada de la lista, en el mismo orden. No agregues ni saques empresas.
- Idioma de cualquier nota: ${idioma}.

SALIDA
Tu ÚLTIMO mensaje debe ser EXCLUSIVAMENTE un array JSON válido (sin markdown, sin texto antes ni después), una entrada por empresa con esta forma exacta:
{
  "empresa": string,            // igual al que te pasé
  "instagram": string|null,     // handle confirmado o corregido (sin @), o null si no hay uno real
  "verificado": boolean         // true SOLO si confirmaste el perfil en la búsqueda
}`;
}

function safeParse(raw: string): { empresa: string; instagram: string | null; verificado: boolean }[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: { empresa: string; instagram: string | null; verificado: boolean }[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const empresa = typeof o.empresa === "string" ? o.empresa.trim() : "";
    if (!empresa) continue;
    out.push({
      empresa,
      instagram: toHandle(typeof o.instagram === "string" ? o.instagram : null),
      verificado: o.verificado === true,
    });
  }
  return out;
}

/**
 * Verifica/corrige los handles de Instagram de un lote de empresas. Devuelve una
 * entrada por empresa de entrada (matcheada por nombre). Si la IA falla o no
 * cubre una empresa, esa entrada queda con verificado=false conservando el handle
 * original (no perdemos el dato, solo lo dejamos sin confirmar).
 */
export async function verifyInstagramBatch(
  items: IgVerifyInput[],
  idioma = "es_ar"
): Promise<IgVerifyResult[]> {
  const conIg = items.filter((i) => toHandle(i.instagram));
  if (conIg.length === 0)
    return items.map((i) => ({ empresa: i.empresa, instagram: null, verificado: false }));

  const lista = conIg
    .map((i, n) => {
      const loc = [i.ciudad, i.pais].filter(Boolean).join(", ");
      const web = i.sitio_web ? ` · web: ${i.sitio_web}` : "";
      return `${n + 1}. ${i.empresa}${loc ? ` (${loc})` : ""} → IG a verificar: @${toHandle(i.instagram)}${web}`;
    })
    .join("\n");

  const userMsg = `Verificá el Instagram de estas ${conIg.length} empresas. Buscá cada perfil antes de responder:\n\n${lista}\n\nDevolvé el array JSON, una entrada por empresa, en este orden.`;

  let parsed: { empresa: string; instagram: string | null; verificado: boolean }[] = [];
  try {
    const msg = await client.messages.create({
      model: AI_MODEL_SMART,
      max_tokens: 2000,
      system: [{ type: "text", text: buildSystem(idioma) }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(conIg.length + 4, 16) }],
      messages: [{ role: "user", content: userMsg }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    parsed = safeParse(text);
  } catch (e) {
    console.warn("verifyInstagramBatch:", (e as Error).message);
  }

  // Match por nombre de empresa (normalizado). Lo que la IA no cubrió queda con
  // el handle original sin verificar.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const byEmpresa = new Map(parsed.map((p) => [norm(p.empresa), p]));

  return items.map((i) => {
    const orig = toHandle(i.instagram);
    if (!orig) return { empresa: i.empresa, instagram: null, verificado: false };
    const hit = byEmpresa.get(norm(i.empresa));
    if (!hit) return { empresa: i.empresa, instagram: orig, verificado: false };
    return { empresa: i.empresa, instagram: hit.instagram, verificado: hit.verificado };
  });
}

/** Verifica una sola empresa (para el botón por-lead). */
export async function verifyInstagramOne(
  item: IgVerifyInput,
  idioma = "es_ar"
): Promise<IgVerifyResult> {
  const [res] = await verifyInstagramBatch([item], idioma);
  return res ?? { empresa: item.empresa, instagram: toHandle(item.instagram), verificado: false };
}
