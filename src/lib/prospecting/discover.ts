/**
 * Descubrimiento de leads para una campaña (cluster) usando la BÚSQUEDA WEB de
 * Claude. La IA busca empresas REALES del rubro en la zona objetivo que sean
 * buenos prospectos para nuestro servicio, y trae datos públicos (web, IG,
 * teléfono, email) SIEMPRE con la fuente. No inventa: si un dato no está, va null.
 *
 * Usa el modelo SMART (Sonnet) porque hay que razonar sobre la calidad del lead
 * y la herramienta de búsqueda web (server-side tool de Anthropic).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";

const client = new Anthropic();

export interface CampaignContext {
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  servicioNombre: string | null;
  servicioDesc: string | null;
  angulo: string | null;
  idioma: string;
  /** Empresas ya cargadas en la campaña, para no repetirlas. */
  excludeEmpresas?: string[];
}

export interface DiscoveredLead {
  empresa: string;
  descripcion: string | null;
  ciudad: string | null;
  pais: string | null;
  sitio_web: string | null;
  instagram: string | null;
  telefono: string | null;
  email: string | null;
  por_que: string | null;
  fit_score: number | null;
  fuente_url: string | null;
}

function buildSystem(ctx: CampaignContext): string {
  const servicio = ctx.servicioNombre
    ? `${ctx.servicioNombre}${ctx.servicioDesc ? ` — ${ctx.servicioDesc}` : ""}`
    : "servicios de marketing digital (gestión de redes, pauta paga, contenido, web)";
  const yaTenemos =
    ctx.excludeEmpresas && ctx.excludeEmpresas.length > 0
      ? `\n\nYA TENEMOS ESTAS EMPRESAS (NO las repitas, buscá distintas):\n${ctx.excludeEmpresas
          .slice(0, 60)
          .map((e) => `- ${e}`)
          .join("\n")}`
      : "";
  return `Sos un prospector B2B senior de JD Media, una agencia de marketing digital de Córdoba, Argentina. Tu trabajo es encontrar EMPRESAS REALES que sean buenos clientes potenciales y traer sus datos de contacto públicos para que el equipo comercial les escriba.

CLUSTER OBJETIVO (campaña: "${ctx.nombre}")
- Rubro / nicho: ${ctx.rubro}
- Zona: ${ctx.ubicacion ?? "sin zona definida (priorizá Argentina y España)"}
- Servicio que vamos a ofrecer: ${servicio}
- Ángulo / problema que resolvemos: ${ctx.angulo ?? "mejorar su presencia digital y traerles más clientes"}${yaTenemos}

CÓMO TRABAJAR
1. Usá la herramienta de búsqueda web para encontrar empresas reales del rubro en la zona. Hacé varias búsquedas distintas (directorios, Google Maps/listados, Instagram, "mejores <rubro> en <zona>", etc.).
2. Priorizá empresas que REALMENTE nos necesitan y pueden pagar: negocios establecidos pero con presencia digital floja (Instagram descuidado, sin pauta, web pobre o inexistente, poca frecuencia de posteo). Ese es nuestro mejor cliente.
3. Para cada empresa juntá SOLO datos públicos y verificables: nombre, qué hace, ciudad/país, sitio web, Instagram (handle), teléfono y email si están publicados. El teléfono SIEMPRE en formato internacional con código de país (ej: +54 351 1234567, +34 612 345 678).
4. Guardá la URL de la fuente de donde sacaste el contacto (web oficial, perfil, directorio).

REGLAS DURAS
- PROHIBIDO inventar datos. Si no encontrás el teléfono/email/IG, poné null. Nunca pongas un número o mail "de ejemplo" ni aproximado.
- Solo empresas reales que existan hoy. Nada de marcas genéricas o inventadas.
- No incluyas competidores nuestros (otras agencias de marketing) salvo que el rubro lo pida explícitamente.
- Evitá grandes multinacionales que ya tienen agencia interna; apuntá a PyMEs y negocios locales/medianos.

SALIDA
Después de investigar, tu ÚLTIMO mensaje debe ser EXCLUSIVAMENTE un array JSON válido (sin markdown, sin texto antes ni después), con esta forma exacta por empresa:
{
  "empresa": string,
  "descripcion": string|null,      // 1 frase: qué hace
  "ciudad": string|null,
  "pais": string|null,
  "sitio_web": string|null,
  "instagram": string|null,        // handle (ej: @marca) o URL
  "telefono": string|null,         // internacional con + y código de país, o null
  "email": string|null,
  "por_que": string|null,          // 1 frase: la señal concreta por la que es buen lead (ej: "Instagram con 1.2k seguidores sin postear hace 2 meses")
  "fit_score": number,             // 0-100: cuán buen prospecto es (ajuste al cluster + cuánto nos necesita + capacidad de pago)
  "fuente_url": string|null
}
Devolvé solo empresas con al menos UNA vía de contacto (web, IG, teléfono o email). Solo el array JSON.`;
}

function safeParseArray(raw: string): DiscoveredLead[] {
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
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const out: DiscoveredLead[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const empresa = str(o.empresa);
    if (!empresa) continue;
    const fit = num(o.fit_score);
    out.push({
      empresa: empresa.slice(0, 160),
      descripcion: str(o.descripcion),
      ciudad: str(o.ciudad),
      pais: str(o.pais),
      sitio_web: str(o.sitio_web),
      instagram: str(o.instagram),
      telefono: str(o.telefono),
      email: str(o.email),
      por_que: str(o.por_que),
      fit_score: fit != null ? Math.max(0, Math.min(100, Math.round(fit))) : null,
      fuente_url: str(o.fuente_url),
    });
  }
  return out;
}

/**
 * Busca hasta `cantidad` empresas reales para el cluster. Devuelve los leads
 * crudos (sin guardar). Lanza el error de Anthropic si falla (lo traduce el route).
 */
export async function discoverLeads(
  ctx: CampaignContext,
  cantidad: number
): Promise<DiscoveredLead[]> {
  const n = Math.min(Math.max(cantidad, 1), 12);
  const userMsg = `Encontrá ${n} empresas reales para este cluster. Investigá bien con varias búsquedas antes de responder y traé el contacto público de cada una con su fuente. Recordá: no inventes ningún dato de contacto.`;

  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 6000,
    system: [{ type: "text", text: buildSystem(ctx) }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return safeParseArray(text).slice(0, n);
}
