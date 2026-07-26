/**
 * Análisis diario de paid media con IA. A partir de las métricas del día (cuenta
 * + campañas) y la tendencia reciente, genera un resumen y sugerencias de mejora
 * accionables. Mismo patrón que el Director Creativo IA.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import type { AdAccountData } from "@/lib/meta/ads";

const MODEL = AI_MODEL_SMART;
const client = new Anthropic();

export interface PaidMediaSuggestion {
  accion: string; // "Subir presupuesto", "Pausar adset", etc.
  motivo: string;
  prioridad: "alta" | "media" | "baja";
  campana?: string;
}
export interface PaidMediaAnalysis {
  resumen: string;
  sugerencias: PaidMediaSuggestion[];
}

export interface AnalysisInput {
  cliente: string;
  rubro: string | null;
  objetivo: string | null; // objetivo de pauta del cliente (leads/ventas/tráfico)
  moneda: string;
  hoy: AdAccountData;
  // Tendencia: spend y conversiones de los últimos días (más viejo → más nuevo).
  historial: { fecha: string; spend: number; conversions: number; cpc: number | null }[];
}

const SYSTEM = `Sos el analista de paid media de JD Media (agencia de Córdoba, Argentina). Cada día revisás las campañas de Meta Ads de un cliente y armás un parte breve y MUY accionable para el media buyer.

Te paso: el cliente y su objetivo de pauta, las métricas del día a nivel cuenta y por campaña (gasto, impresiones, clicks, CTR, CPC, CPM, conversiones, costo por conversión, presupuesto diario y estado de cada campaña), y la tendencia de los últimos días.

Devolvé SOLO un objeto JSON válido (sin texto alrededor, sin markdown) con esta forma exacta:
{
  "resumen": "2-4 frases en español rioplatense (vos) sobre cómo viene la pauta: qué funciona, qué se está yendo de costo, dónde está el resultado. Concreto y sin relleno.",
  "sugerencias": [
    { "accion": "qué hacer, concreto (ej: 'Subir 20% el presupuesto de la campaña X')", "motivo": "por qué, con el dato que lo respalda", "prioridad": "alta|media|baja", "campana": "nombre de la campaña afectada (o vacío si es a nivel cuenta)" }
  ]
}

Reglas:
- Entre 0 y 5 sugerencias, priorizadas. Si todo viene bien, "sugerencias" puede ser un array vacío y el resumen lo refleja.
- Basate en los datos: si una campaña tiene costo por resultado alto y poco resultado, sugerí pausar o revisar creativo; si una rinde bien y tiene techo, sugerí subir presupuesto; si el gasto sube sin ningún resultado, alertá.

MUY IMPORTANTE — JUZGÁ SEGÚN EL OBJETIVO DE CADA CAMPAÑA:
- El "resultado" NO es siempre una compra o un lead. Cada campaña trae su campo "resultados" con lo que de verdad logró (interacciones, seguidores nuevos, clicks al link, reproducciones, mensajes, etc.). ESO es el resultado.
- Mapeá el objetivo de Meta a lo que hay que mirar:
  · Interacción / OUTCOME_ENGAGEMENT / POST_ENGAGEMENT → interacciones, reacciones, comentarios, seguidores.
  · Seguidores / me gusta de la página / PAGE_LIKES → seguidores nuevos, "me gusta / seguidores de página".
  · Reconocimiento / OUTCOME_AWARENESS / REACH → alcance e impresiones.
  · Tráfico / OUTCOME_TRAFFIC / LINK_CLICKS → clicks al link y vistas de landing.
  · Mensajes / OUTCOME_ENGAGEMENT (mensajería) → conversaciones/mensajes iniciados.
  · Videos / VIDEO_VIEWS → reproducciones.
  · Leads / OUTCOME_LEADS y Ventas / OUTCOME_SALES → recién ahí mirás conversiones y costo por conversión.
- PROHIBIDO decir "no logró resultados" o "sin resultados" si la campaña tiene interacciones, seguidores, clicks o cualquier valor en "resultados", aunque conversiones sea 0. Una campaña de interacción con 0 conversiones que sumó seguidores ESTÁ funcionando: evaluá el COSTO POR RESULTADO de su objetivo, no las conversiones.
- Si el objetivo no está claro, deducilo por dónde están los resultados y por el objetivo de pauta del cliente.

- Nada de emojis. Español rioplatense. No inventes métricas que no te di.`;

function buildUserText(p: AnalysisInput): string {
  const fmtResultados = (rs: { tipo: string; valor: number; costo: number | null }[]) =>
    rs.length
      ? rs
          .map((r) => `${r.valor} ${r.tipo}${r.costo != null ? ` (a ${r.costo} c/u)` : ""}`)
          .join(", ")
      : "sin acciones registradas";

  const a = p.hoy.account;
  const camp = p.hoy.campaigns
    .map(
      (c) =>
        `- ${c.nombre} [${c.estado}${c.objetivo ? ` · objetivo Meta: ${c.objetivo}` : ""}${
          c.daily_budget != null ? ` · ppto/día ${p.moneda} ${c.daily_budget}` : ""
        }]: gasto ${c.spend}, impr ${c.impressions}, alcance ${c.reach}, clicks ${c.clicks}, CTR ${
          c.ctr ?? "-"
        }%, CPC ${c.cpc ?? "-"}. RESULTADOS: ${fmtResultados(c.resultados)}.`
    )
    .join("\n");
  const trend = p.historial
    .map((h) => `  ${h.fecha}: gasto ${h.spend}, conv ${h.conversions}, CPC ${h.cpc ?? "-"}`)
    .join("\n");
  return [
    `Cliente: ${p.cliente}${p.rubro ? ` (rubro: ${p.rubro})` : ""}`,
    `Objetivo de pauta: ${p.objetivo ?? "no definido"}`,
    `Moneda: ${p.moneda}`,
    ``,
    `Métricas de AYER a nivel cuenta: gasto ${a.spend}, impresiones ${a.impressions}, alcance ${a.reach}, clicks ${a.clicks}, CTR ${a.ctr ?? "-"}%, CPC ${a.cpc ?? "-"}, CPM ${a.cpm ?? "-"}. Resultados de la cuenta: ${fmtResultados(a.resultados)}.`,
    ``,
    `Campañas (ayer):`,
    camp || "(sin campañas con datos)",
    ``,
    `Tendencia últimos días:`,
    trend || "(sin historial)",
  ].join("\n");
}

function safeParse(text: string): PaidMediaAnalysis | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      resumen?: unknown;
      sugerencias?: unknown;
    };
    const resumen = typeof obj.resumen === "string" ? obj.resumen : "";
    const arr = Array.isArray(obj.sugerencias) ? obj.sugerencias : [];
    const sugerencias: PaidMediaSuggestion[] = arr
      .map((s) => s as Record<string, unknown>)
      .filter((s) => typeof s.accion === "string")
      .map((s) => ({
        accion: String(s.accion),
        motivo: typeof s.motivo === "string" ? s.motivo : "",
        prioridad:
          s.prioridad === "alta" || s.prioridad === "baja" ? s.prioridad : "media",
        campana: typeof s.campana === "string" && s.campana ? s.campana : undefined,
      }));
    if (!resumen && sugerencias.length === 0) return null;
    return { resumen, sugerencias };
  } catch {
    return null;
  }
}

/** Genera el análisis del día. Devuelve null si la IA falla. */
export async function generatePaidMediaAnalysis(
  p: AnalysisInput
): Promise<PaidMediaAnalysis | null> {
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserText(p) }],
    });
    void trackAiUsage({ ruta: "paid-media/analisis", modelo: MODEL, usage: msg.usage });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return safeParse(text);
  } catch {
    return null;
  }
}
