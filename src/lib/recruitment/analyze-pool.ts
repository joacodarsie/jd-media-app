/**
 * Análisis de un CV para el POOL de talento: en vez de puntuar contra un puesto,
 * la IA puntúa el CV contra TODAS las áreas de la agencia a la vez (0-100 cada
 * una), elige el mejor rol y deja los datos estructurados. Una sola llamada
 * (Haiku) por CV. Con esto el pool se filtra por rol mostrando, para cada área,
 * los candidatos más aptos.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";
import { AREA_OPTIONS } from "@/lib/recruitment/areas";

const client = new Anthropic();

// Áreas que se puntúan (las que tienen perfil de puesto). Excluye "otro".
const POOL_AREAS = AREA_OPTIONS.filter((a) => a.value !== "otro");

export interface PoolCvAnalysis {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  ubicacion: string | null;
  es_cordoba_capital: boolean | null;
  anios_experiencia: number | null;
  skills: string[];
  educacion: string | null;
  resumen: string | null;
  fortalezas: string[];
  dudas: string[];
  area_scores: Record<string, number>;
  best_area: string | null;
  fit_score: number | null; // = puntaje del mejor área
}

function buildSystem(areaProfiles: Record<string, string>): string {
  const bloques = POOL_AREAS.map((a) => {
    const perfil = areaProfiles[a.value]?.trim();
    return `### Área "${a.value}" (${a.label})\n${perfil || "Sin perfil cargado; evaluá aptitud general para el área."}`;
  }).join("\n\n");
  const claves = POOL_AREAS.map((a) => `"${a.value}": number`).join(", ");

  return `Sos un reclutador senior de JD Media, una agencia de marketing digital de Córdoba, Argentina. Te llegan CVs de TODO tipo y tenés que clasificar a cada persona según para qué ROL de la agencia es más apta. Devolvés datos estructurados.

ÁREAS DE LA AGENCIA Y QUÉ HACE CADA UNA:
${bloques}

Te paso el TEXTO de un CV. Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto alrededor) con esta forma exacta:
{
  "nombre": string|null,
  "email": string|null,
  "telefono": string|null,
  "ubicacion": string|null,            // ciudad/provincia tal como figura
  "es_cordoba_capital": boolean|null,  // true SOLO si es de Córdoba Capital
  "anios_experiencia": number|null,    // años de experiencia relevante (estimado)
  "skills": string[],                  // herramientas/habilidades clave
  "educacion": string|null,            // título/formación más relevante en una línea
  "resumen": string|null,              // 1-2 frases: quién es y qué ofrece, en español rioplatense
  "area_scores": { ${claves} },        // 0-100 para CADA área: qué tan apto es para ESE rol
  "best_area": string,                 // el value del área con mayor puntaje
  "fortalezas": string[],              // 2-4 puntos fuertes para su MEJOR área
  "dudas": string[]                    // 0-3 dudas/faltantes
}

Cómo puntuar cada área (area_scores):
- Para cada área, evaluá qué tan apto está SEGÚN lo que hace ese rol (experiencia real, herramientas, formación). Un editor de video puntúa alto en "edicion" y bajo en "comercial"; un diseñador alto en "diseno", etc.
- Reconocé skills transferibles, pero no infles: si no hay evidencia para un área, va bajo (0-30).
- "best_area" es el área con mayor puntaje.
- Córdoba Capital NO entra en el puntaje (se filtra aparte con es_cordoba_capital).

Reglas:
- Basate SOLO en lo que dice el CV. No inventes datos de contacto ni experiencia.
- Si el texto no parece un CV o está vacío, devolvé casi todo null, area_scores en 0 y una duda explicando que no se pudo leer.
- Solo el JSON, nada más.`;
}

function safeParse(raw: string): PoolCvAnalysis | null {
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
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

    const scores: Record<string, number> = {};
    const rawScores = (o.area_scores ?? {}) as Record<string, unknown>;
    for (const a of POOL_AREAS) {
      const n = num(rawScores[a.value]);
      if (n != null) scores[a.value] = clamp(n);
    }
    // Mejor área: la del JSON si es válida, si no la de mayor puntaje.
    let best = str(o.best_area);
    if (!best || !(best in scores)) {
      best =
        Object.entries(scores).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    }
    const fit = best ? scores[best] ?? null : null;

    return {
      nombre: str(o.nombre),
      email: str(o.email),
      telefono: str(o.telefono),
      ubicacion: str(o.ubicacion),
      es_cordoba_capital:
        typeof o.es_cordoba_capital === "boolean" ? o.es_cordoba_capital : null,
      anios_experiencia: num(o.anios_experiencia),
      skills: arr(o.skills),
      educacion: str(o.educacion),
      resumen: str(o.resumen),
      fortalezas: arr(o.fortalezas),
      dudas: arr(o.dudas),
      area_scores: scores,
      best_area: best,
      fit_score: fit,
    };
  } catch {
    return null;
  }
}

/** Analiza un CV contra todas las áreas. Devuelve null si falla. */
export async function analyzeCvForPool(
  cvText: string,
  areaProfiles: Record<string, string>
): Promise<PoolCvAnalysis | null> {
  const text = cvText.trim().slice(0, 24_000);
  if (text.length < 40) return null;
  try {
    const msg = await client.messages.create({
      model: AI_MODEL_FAST,
      max_tokens: 1400,
      system: [
        { type: "text", text: buildSystem(areaProfiles), cache_control: { type: "ephemeral" } },
      ],
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
