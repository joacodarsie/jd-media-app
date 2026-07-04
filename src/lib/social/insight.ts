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
  // Contenido publicado en el mes (lo que produjo el equipo).
  contenido?: {
    total: number;
    posts: number;
    reels: number;
    carruseles: number;
    historias: number;
    titulos: string[];
  };
  // Historias de Instagram del mes (rendimiento real).
  historias?: {
    count: number;
    reach: number | null;
    replies: number | null;
  };
}

const SYSTEM = `Sos el equipo de JD Media (agencia de Córdoba, Argentina) escribiendo, para el CLIENTE, una lectura de los resultados de su mes en redes. Va en el reporte mensual y en el portal del cliente.

Te paso los números REALES del mes: resultados de Instagram (seguidores totales, seguidores nuevos, alcance, visitas al perfil, interacciones), el contenido que publicamos (cuántas piezas y de qué tipo: posts, reels, carruseles, historias, con algunos títulos), el rendimiento de las historias (alcance y respuestas) y, si hubo pauta, los de publicidad (inversión, conversiones, costo por conversión, impresiones, clicks, CTR).

Escribí en español rioplatense (vos), cálido y profesional, dirigido al cliente, 2 a 3 párrafos cortos, que:
- Interprete qué dicen los números (no los repitas como lista: explicá qué significan y si es bueno). Conectá el orgánico con la pauta cuando ambos existan (el resultado final es la suma de los dos).
- Relacione el TRABAJO del mes (el contenido que se publicó y las historias) con los resultados: el alcance y las interacciones son consecuencia de ese contenido. Si se publicó volumen o un formato puntual, mencionalo como parte del por qué.
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
    if (p.ig.reach != null) lines.push(`- Alcance: ${p.ig.reach}`);
    if (p.ig.profileViews != null) lines.push(`- Visitas al perfil: ${p.ig.profileViews}`);
    if (p.ig.interactions != null) lines.push(`- Interacciones: ${p.ig.interactions}`);
    lines.push("");
  }
  if (p.contenido && p.contenido.total > 0) {
    const c = p.contenido;
    lines.push("Contenido publicado este mes:");
    lines.push(`- Total de piezas: ${c.total}`);
    const desglose: string[] = [];
    if (c.posts) desglose.push(`${c.posts} post(s)`);
    if (c.carruseles) desglose.push(`${c.carruseles} carrusel(es)`);
    if (c.reels) desglose.push(`${c.reels} reel(s)`);
    if (c.historias) desglose.push(`${c.historias} historia(s)`);
    if (desglose.length) lines.push(`- Desglose: ${desglose.join(", ")}`);
    if (c.titulos.length) lines.push(`- Algunos títulos: ${c.titulos.join("; ")}`);
    lines.push("");
  }
  if (p.historias && p.historias.count > 0) {
    lines.push("Historias de Instagram (rendimiento):");
    lines.push(`- Historias publicadas: ${p.historias.count}`);
    if (p.historias.reach != null) lines.push(`- Alcance total de historias: ${p.historias.reach}`);
    if (p.historias.replies != null) lines.push(`- Respuestas a historias: ${p.historias.replies}`);
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

// ── Guión INTERNO del meet mensual con el cliente ──

export interface MeetGuidePayload extends ResultsReadingPayload {
  /** Métricas del mes ANTERIOR, para marcar qué subió/bajó (opcional). */
  prev?: {
    reach: number | null;
    seguidoresNuevos: number | null;
    interactions: number | null;
    spend: number | null;
    conversions: number | null;
  } | null;
  /** Comentarios/feedback del cliente en el portal este mes (opcional). */
  comentariosCliente?: string[];
}

const MEET_SYSTEM = `Sos un/a coordinador/a de JD Media (agencia de Córdoba, Argentina) preparando el GUIÓN INTERNO para conducir la reunión mensual con un cliente. Este texto es SOLO para el equipo (no lo ve el cliente): es tu ayudamemoria para llevar bien el meet, mostrar resultados y detectar oportunidades.

Te paso los números REALES del mes (Instagram orgánico, contenido publicado, historias y, si hubo, pauta), la comparación con el mes anterior cuando está disponible, y los comentarios que dejó el cliente.

Armá un guión claro en español rioplatense (vos), en MARKDOWN, con estas secciones (usá ## para los títulos):
## Cómo abrir
1-2 frases para arrancar el meet en tono positivo y humano.
## Resultados para destacar
Los logros del mes con los números concretos. Si tenés el mes anterior, decí explícitamente qué subió y cuánto.
## Para hablar con honestidad
Lo que no creció o cayó, planteado sin excusas y orientado a la acción. Si algo bajó respecto al mes anterior, marcalo.
## Oportunidades a proponer
Ideas concretas para el mes que viene y, cuando corresponda, propuestas de más servicio (más pauta, un formato nuevo, una campaña, subir de pack). Que sean accionables y justificadas por los números.
## Preguntas para hacerle al cliente
3-4 preguntas abiertas para entender su negocio, sus próximos lanzamientos y su percepción.
## Próximos pasos
Compromisos concretos para cerrar el meet.

Reglas estrictas:
- USÁ SOLO los números que te paso. NO inventes métricas, ventas ni datos.
- Si un bloque no tiene datos (ej. no hubo pauta o no hay mes anterior), no lo menciones ni lo inventes.
- Sé concreto y breve: bullets cortos, nada de relleno. Es un ayudamemoria, no un ensayo.`;

function buildMeetUserText(p: MeetGuidePayload): string {
  const base = buildUserText(p);
  const lines: string[] = [base, ""];
  if (p.prev) {
    lines.push("Comparación con el mes ANTERIOR (para marcar subió/bajó):");
    if (p.prev.reach != null) lines.push(`- Alcance mes anterior: ${p.prev.reach}`);
    if (p.prev.seguidoresNuevos != null) lines.push(`- Seguidores nuevos mes anterior: ${p.prev.seguidoresNuevos}`);
    if (p.prev.interactions != null) lines.push(`- Interacciones mes anterior: ${p.prev.interactions}`);
    if (p.prev.spend != null) lines.push(`- Inversión en pauta mes anterior: ${Math.round(p.prev.spend)}`);
    if (p.prev.conversions != null) lines.push(`- Conversiones mes anterior: ${p.prev.conversions}`);
    lines.push("");
  }
  if (p.comentariosCliente && p.comentariosCliente.length > 0) {
    lines.push("Comentarios que dejó el cliente este mes:");
    for (const c of p.comentariosCliente.slice(0, 10)) lines.push(`- ${c}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Genera el guión interno del meet. Null si la IA falla o no hay datos. */
export async function generateMeetGuide(p: MeetGuidePayload): Promise<string | null> {
  const hayHistorias = !!p.historias && p.historias.count > 0;
  if (!p.ig.hasData && !p.paid.hasData && !hayHistorias) return null;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system: [{ type: "text", text: MEET_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildMeetUserText(p) }],
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

/** Genera la lectura del mes. Null si la IA falla o no hay datos. */
export async function generateResultsReading(
  p: ResultsReadingPayload
): Promise<string | null> {
  const hayHistorias = !!p.historias && p.historias.count > 0;
  if (!p.ig.hasData && !p.paid.hasData && !hayHistorias) return null;
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
