/**
 * Análisis de un CV con IA. Toma el texto del CV + el perfil buscado y devuelve
 * datos estructurados (ubicación, área, experiencia, skills, resumen) + un
 * puntaje de aptitud (fit) 0-100. Usa el modelo rápido (Haiku) porque es alto
 * volumen: una búsqueda puede traer cientos de CVs.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";

const client = new Anthropic();

export interface SearchContext {
  titulo: string;
  area: string | null;
  perfil: string | null;
  ubicacionPref: string | null;
}

export interface CvAnalysis {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  ubicacion: string | null;
  es_cordoba_capital: boolean | null;
  area: string | null;
  anios_experiencia: number | null;
  skills: string[];
  educacion: string | null;
  resumen: string | null;
  fortalezas: string[];
  dudas: string[];
  fit_score: number | null;
}

function buildSystem(ctx: SearchContext): string {
  return `Sos un reclutador senior de JD Media, una agencia de marketing digital de Córdoba, Argentina. Analizás CVs para una búsqueda de empleo y devolvés datos estructurados.

BÚSQUEDA ACTUAL:
- Puesto: ${ctx.titulo}
- Área: ${ctx.area ?? "no especificada"}
- Ubicación preferida: ${ctx.ubicacionPref ?? "Córdoba Capital"}
- Perfil buscado: ${ctx.perfil?.trim() || "No se dio un detalle; evaluá aptitud general para el puesto."}

Te paso el TEXTO de un CV. Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto alrededor) con esta forma exacta:
{
  "nombre": string|null,
  "email": string|null,
  "telefono": string|null,
  "ubicacion": string|null,            // ciudad/provincia tal como figura
  "es_cordoba_capital": boolean|null,  // true SOLO si es de Córdoba Capital (no interior ni otra provincia); null si no se puede inferir
  "area": string|null,                 // área principal del candidato (ej: edición, diseño, community manager, pauta, desarrollo)
  "anios_experiencia": number|null,    // años de experiencia relevante (estimado)
  "skills": string[],                  // herramientas/habilidades clave (ej: Premiere, Photoshop, Meta Ads)
  "educacion": string|null,            // título/formación más relevante en una línea
  "resumen": string|null,              // 1-2 frases: quién es y qué ofrece, en español rioplatense
  "fortalezas": string[],              // 2-4 puntos fuertes para ESTE puesto
  "dudas": string[],                   // 0-3 dudas o faltantes para este puesto
  "fit_score": number|null             // 0-100: qué tan calificado/apto está para el puesto buscado
}

Reglas:
- Basate SOLO en lo que dice el CV. No inventes datos de contacto ni experiencia.
- Ubicación: Córdoba Capital es importante para esta búsqueda, pero el fit_score debe reflexar sobre todo la APTITUD para el puesto (experiencia, skills, formación), no solo la ubicación.
- Si el texto no parece un CV o está vacío, devolvé el JSON con casi todo null, fit_score 0, y una duda explicando que no se pudo leer.
- Solo el JSON, nada más.`;
}

function safeParse(raw: string): CvAnalysis | null {
  // La IA puede envolver el JSON; recortamos al primer { … último }.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const str = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;
    return {
      nombre: str(o.nombre),
      email: str(o.email),
      telefono: str(o.telefono),
      ubicacion: str(o.ubicacion),
      es_cordoba_capital:
        typeof o.es_cordoba_capital === "boolean" ? o.es_cordoba_capital : null,
      area: str(o.area),
      anios_experiencia: num(o.anios_experiencia),
      skills: arr(o.skills),
      educacion: str(o.educacion),
      resumen: str(o.resumen),
      fortalezas: arr(o.fortalezas),
      dudas: arr(o.dudas),
      fit_score: num(o.fit_score) != null ? Math.max(0, Math.min(100, num(o.fit_score)!)) : null,
    };
  } catch {
    return null;
  }
}

/** Analiza el texto de un CV contra una búsqueda. Devuelve null si falla. */
export async function analyzeCv(
  cvText: string,
  ctx: SearchContext
): Promise<CvAnalysis | null> {
  const text = cvText.trim().slice(0, 24_000); // recorte defensivo
  if (text.length < 40) return null;
  try {
    const msg = await client.messages.create({
      model: AI_MODEL_FAST,
      max_tokens: 1200,
      system: [{ type: "text", text: buildSystem(ctx), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `TEXTO DEL CV:\n\n${text}` }],
    });
    const out = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return safeParse(out);
  } catch {
    return null;
  }
}
