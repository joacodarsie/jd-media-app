/**
 * Lectura con IA de los RESULTADOS del mes para el cliente. Interpreta los números
 * reales (Instagram orgánico + paid media) y los traduce a un texto cálido y
 * profesional que se muestra en el reporte y en el portal. On-demand (lo dispara
 * el equipo desde el reporte) para no gastar tokens todos los días.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";

const MODEL = AI_MODEL_SMART;
const client = new Anthropic();

export interface ResultsReadingPayload {
  nombre: string;
  mesLabel: string;
  ig: {
    hasData: boolean;
    followersEnd: number | null;
    seguidoresNuevos: number | null;
    reach: number | null;
    profileViews: number | null;
    interactions: number | null;
  };
  paid: {
    hasData: boolean;
    moneda: string;
    spend: number;
    conversions: number;
    costPerConv: number | null;
    impressions: number;
    clicks: number;
    ctr: number | null;
  };
}

const SYSTEM = `Sos el equipo de JD Media (agencia de Córdoba, Argentina) escribiendo, para el CLIENTE, una lectura de los resultados de su mes en redes. Va en el reporte mensual y en el portal del cliente.

Te paso los números REALES del mes: resultados de Instagram (seguidores totales, seguidores nuevos, alcance, visitas al perfil, interacciones) y, si hubo pauta, los de publicidad (inversión, conversiones, costo por conversión, impresiones, clicks, CTR).

Escribí en español rioplatense (vos), cálido y profesional, dirigido al cliente, 2 a 3 párrafos cortos, que:
- Interprete qué dicen los números (no los repitas como lista: explicá qué significan y si es bueno). Conectá el orgánico con la pauta cuando ambos existan (el resultado final es la suma de los dos).
- Sea honesto: si algo no creció o no rindió, decilo en positivo y orientado a la acción del mes que viene.
- Cierre con una mirada de qué optimizar o potenciar.

Reglas estrictas:
- USÁ SOLO los números que te paso. NO inventes métricas, ventas ni datos que no estén.
- Si un bloque no tiene datos (por ejemplo no hubo pauta), no lo menciones.
- Nada de markdown ni encabezados, solo párrafos. Sin emojis (o como mucho uno suave). Devolvé SOLO el texto, sin comillas alrededor.`;

function buildUserText(p: ResultsReadingPayload): string {
  const lines: string[] = [`Cliente: ${p.nombre}`, `Mes: ${p.mesLabel}`, ``];
  if (p.ig.hasData) {
    lines.push("Resultados de Instagram (orgánico):");
    if (p.ig.followersEnd != null) lines.push(`- Seguidores totales: ${p.ig.followersEnd}`);
    if (p.ig.seguidoresNuevos != null) lines.push(`- Seguidores nuevos en el mes: ${p.ig.seguidoresNuevos}`);
    if (p.ig.reach != null) lines.push(`- Alcance (28 días): ${p.ig.reach}`);
    if (p.ig.profileViews != null) lines.push(`- Visitas al perfil: ${p.ig.profileViews}`);
    if (p.ig.interactions != null) lines.push(`- Interacciones: ${p.ig.interactions}`);
    lines.push("");
  }
  if (p.paid.hasData) {
    lines.push("Resultados de publicidad (paid media):");
    lines.push(`- Inversión: ${p.paid.moneda} ${Math.round(p.paid.spend)}`);
    lines.push(`- Conversiones: ${p.paid.conversions}`);
    if (p.paid.costPerConv != null) lines.push(`- Costo por conversión: ${p.paid.moneda} ${p.paid.costPerConv}`);
    lines.push(`- Impresiones: ${p.paid.impressions}`);
    lines.push(`- Clicks: ${p.paid.clicks}`);
    if (p.paid.ctr != null) lines.push(`- CTR: ${p.paid.ctr}%`);
    lines.push("");
  }
  if (!p.ig.hasData && !p.paid.hasData) {
    lines.push("(No hay datos automáticos de resultados este mes.)");
  }
  return lines.join("\n");
}

/** Genera la lectura del mes. Null si la IA falla o no hay datos. */
export async function generateResultsReading(
  p: ResultsReadingPayload
): Promise<string | null> {
  if (!p.ig.hasData && !p.paid.hasData) return null;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserText(p) }],
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
