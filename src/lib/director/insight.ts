import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const client = new Anthropic();

export interface DirectorIdea {
  titulo: string;
  red: string; // instagram | facebook | tiktok | ...
  tipo: string; // reel | post | carrusel | historia | video
  pilar?: string;
  copy?: string;
  applied_pub_id?: string | null;
}

export interface DirectorInsight {
  resumen: string;
  ideas: DirectorIdea[];
}

export interface InsightPayload {
  nombre: string;
  rubro: string | null;
  packDesc: string;
  quotaReels: number;
  quotaPosts: number;
  proyReels: number; // planeados en el calendario
  proyPosts: number;
  pubReels: number; // efectivamente publicados
  pubPosts: number;
  pipelineNext: number;
  diagSummary: string;
  planSummary: string;
}

const SYSTEM = `Sos el Director Creativo de JD Media (agencia de Córdoba, Argentina: gestión de redes, paid media, diseño, web para PyMEs).

Cada viernes revisás cómo viene cada cliente respecto al pack que contrató y armás un parte breve y accionable para el equipo.

Te paso, de UN cliente: su pack y cuota mensual; cuántas piezas tiene PLANEADAS en el calendario y cuántas PUBLICÓ efectivamente este mes (es clave distinguir las dos cosas); qué tiene en el pipeline de las próximas 2 semanas; su diagnóstico estratégico (pilares, tono) y su plan de contenido vigente (mix, temas, campañas).

En el resumen aclará tanto lo planeado como lo publicado: una cosa es que el calendario esté lleno y otra que se haya subido. Si hay piezas planeadas sin publicar, mencionalo.

Devolvé SOLO un objeto JSON válido (sin texto alrededor, sin markdown) con esta forma exacta:
{
  "resumen": "2-3 frases en español rioplatense (vos) sobre cómo viene el cliente este mes vs su pack y plan. Concreto: qué está bien, qué falta, qué priorizar. Sin relleno.",
  "ideas": [
    { "titulo": "título corto de la pieza", "red": "instagram|facebook|tiktok", "tipo": "reel|post|carrusel|historia", "pilar": "pilar del plan al que responde", "copy": "1-2 líneas de copy sugerido" }
  ]
}

Reglas:
- Generá entre 2 y 4 ideas, priorizando cubrir las piezas que faltan (reels/posts) y respetando los pilares y temas destacados del plan. No inventes pilares que no estén en el diagnóstico/plan si los hay.
- Si el cliente está al día y el pipeline sano, "ideas" puede ser un array vacío y el resumen lo refleja.
- No excedas la cuota del pack. Las ideas son para LLEGAR a la cuota, no superarla.
- Nada de emojis. Español rioplatense.`;

function buildUserText(p: InsightPayload): string {
  const faltanReelsCal = Math.max(0, p.quotaReels - p.proyReels);
  const faltanPostsCal = Math.max(0, p.quotaPosts - p.proyPosts);
  return [
    `Cliente: ${p.nombre}${p.rubro ? ` (rubro: ${p.rubro})` : ""}`,
    ``,
    p.packDesc,
    ``,
    `Estado del mes en curso (distinguí PLANEADO en el calendario vs PUBLICADO efectivamente):`,
    `- Reels: cuota ${p.quotaReels} | planeados en calendario ${p.proyReels} | publicados ${p.pubReels}. Faltan planear ${faltanReelsCal}.`,
    `- Posts: cuota ${p.quotaPosts} | planeados en calendario ${p.proyPosts} | publicados ${p.pubPosts}. Faltan planear ${faltanPostsCal}.`,
    `- Pubs programadas próximas 2 semanas: ${p.pipelineNext}`,
    ``,
    `Diagnóstico estratégico:`,
    p.diagSummary || "(sin diagnóstico aprobado)",
    ``,
    `Plan de contenido vigente:`,
    p.planSummary || "(sin plan activo)",
  ].join("\n");
}

function safeParse(text: string): DirectorInsight | null {
  // El modelo puede envolver en ```json ... ```; extraemos el primer objeto {}.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      resumen?: unknown;
      ideas?: unknown;
    };
    const resumen = typeof obj.resumen === "string" ? obj.resumen : "";
    const ideasRaw = Array.isArray(obj.ideas) ? obj.ideas : [];
    const ideas: DirectorIdea[] = ideasRaw
      .map((i) => i as Record<string, unknown>)
      .filter((i) => typeof i.titulo === "string")
      .map((i) => ({
        titulo: String(i.titulo),
        red: typeof i.red === "string" ? i.red : "instagram",
        tipo: typeof i.tipo === "string" ? i.tipo : "post",
        pilar: typeof i.pilar === "string" ? i.pilar : undefined,
        copy: typeof i.copy === "string" ? i.copy : undefined,
      }));
    if (!resumen && ideas.length === 0) return null;
    return { resumen, ideas };
  } catch {
    return null;
  }
}

// ───────────────── Narrativa del reporte mensual (cliente) ─────────────────

export interface MonthlyNarrativePayload {
  nombre: string;
  mesLabel: string;
  pack: string | null;
  quotaReels: number;
  quotaPosts: number;
  pubReels: number;
  pubPosts: number;
  piezas: { titulo: string; red: string; tipo: string }[];
  planTemas: string;
  diagTono: string;
}

const NARRATIVE_SYSTEM = `Sos el equipo de JD Media escribiendo el resumen del mes que se le ENVÍA AL CLIENTE junto a su reporte mensual.

Te paso: el pack contratado y su cuota, qué piezas se publicaron efectivamente en el mes, los temas del plan y el tono de la marca.

Escribí un texto en español rioplatense (vos), cálido y profesional, dirigido al cliente, de 2 a 4 párrafos cortos, que:
- Resuma qué se hizo este mes (cantidad y tipo de piezas publicadas) y si se cumplió el pack contratado (si faltó algo, decilo con honestidad y en positivo: qué se reprograma).
- Destaque el valor y los cambios positivos generados (consistencia, línea de comunicación, temas trabajados), SIN inventar métricas numéricas de alcance/seguidores (esas las completa el equipo aparte).
- Cierre con una nota de próximos pasos / qué viene el mes siguiente.

NO inventes datos de reach, seguidores ni ventas. NO uses markdown ni encabezados, solo párrafos. Sin emojis excesivos (máximo alguno suave). Devolvé SOLO el texto del resumen, sin comillas ni nada alrededor.`;

/** Genera la narrativa del reporte mensual para el cliente. Null si falla. */
export async function generateMonthlyNarrative(
  p: MonthlyNarrativePayload
): Promise<string | null> {
  try {
    const piezasTxt =
      p.piezas.length > 0
        ? p.piezas
            .slice(0, 40)
            .map((x) => `- ${x.tipo} (${x.red}): ${x.titulo}`)
            .join("\n")
        : "(no se registran piezas publicadas este mes)";
    const userText = [
      `Cliente: ${p.nombre}`,
      `Mes: ${p.mesLabel}`,
      `Pack: ${p.pack ?? "no definido"} — cuota ${p.quotaReels} reels y ${p.quotaPosts} posts.`,
      `Publicado este mes: ${p.pubReels} reels y ${p.pubPosts} posts.`,
      ``,
      `Piezas publicadas:`,
      piezasTxt,
      ``,
      `Temas del plan: ${p.planTemas || "(sin plan)"}`,
      `Tono de marca: ${p.diagTono || "(sin diagnóstico)"}`,
    ].join("\n");

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: NARRATIVE_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Genera resumen + ideas para un cliente. Devuelve null si la IA falla. */
export async function generateInsight(
  p: InsightPayload
): Promise<DirectorInsight | null> {
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserText(p) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return safeParse(text);
  } catch {
    return null;
  }
}
