/**
 * Genera la PLANTILLA de mensajes de una CAMPAÑA (no de un lead puntual): el
 * mensaje ideal para ese rubro + una alternativa con otro ángulo + una mini
 * cadena de 2 seguimientos. La idea es que el director copie el mensaje y lo
 * adapte con el nombre de cada empresa del mismo rubro (deja un hueco [NOMBRE]).
 *
 * Usa el modelo SMART (es el mensaje que decide si cierra) y NO usa búsqueda web
 * (es genérico del rubro, barato).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { AGENCY } from "@/lib/agency";
import { trackAiUsage } from "@/lib/ai/usage";

const client = new Anthropic();

export interface CampaignMsgContext {
  rubro: string;
  ubicacion: string | null;
  servicioNombre: string | null;
  servicioDesc: string | null;
  angulo: string | null;
  canal: string;
  idioma: string;
  /** Nombre de quien genera (y va a mandar) el mensaje: lo firma él, no siempre el dueño. */
  autorNombre?: string | null;
}

export interface CampaignMessages {
  primer_mensaje: string;
  alternativa: string;
  seguimiento_1: string;
  seguimiento_2: string;
}

function langInstruction(idioma: string): string {
  if (idioma === "en") return "Escribí en INGLÉS, tono profesional y cercano.";
  if (idioma === "es") return "Escribí en español NEUTRO (sin voseo argentino).";
  return "Escribí en español rioplatense (voseo), tono cordobés, cercano y profesional.";
}

function channelInstruction(canal: string, autor: string): string {
  if (canal === "email")
    return `Es un EMAIL en frío: incluí "Asunto: ..." (corto, con interés claro, sin sonar a promoción) y firmá al final como ${autor}, ${AGENCY.brand}. Cuerpo de 5 líneas como máximo.`;
  if (canal === "instagram")
    return `Es un DM de Instagram: cordial y directo, sin asunto ni firma al pie (te presentás en el saludo).`;
  return `Es un mensaje de WhatsApp: cordial y directo, sin asunto ni firma al pie (te presentás en el saludo).`;
}

function safeParse(raw: string): CampaignMessages | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const str = (v: unknown): string =>
    typeof v === "string" && v.trim() ? v.trim() : "";
  const primer = str(o.primer_mensaje);
  if (!primer) return null;
  return {
    primer_mensaje: primer,
    alternativa: str(o.alternativa),
    seguimiento_1: str(o.seguimiento_1),
    seguimiento_2: str(o.seguimiento_2),
  };
}

export async function generateCampaignMessages(
  ctx: CampaignMsgContext
): Promise<CampaignMessages | null> {
  const servicio = ctx.servicioNombre
    ? `${ctx.servicioNombre}${ctx.servicioDesc ? ` (${ctx.servicioDesc})` : ""}`
    : "marketing digital (gestión de redes, pauta, contenido)";

  const autor = (ctx.autorNombre?.trim().split(/\s+/)[0]) || AGENCY.representante;
  const system = `Sos ${autor}, de ${AGENCY.brand}, agencia de marketing digital de Córdoba, Argentina. Armá una PLANTILLA de mensajes de contacto en frío para toda una campaña de un rubro. Se va a COPIAR y pegar cambiando solo el nombre de la empresa, así que tiene que funcionar tal cual para cualquier negocio de este rubro.

CAMPAÑA
- Rubro / nicho: ${ctx.rubro}
- Zona: ${ctx.ubicacion ?? "Argentina"}
- Qué ofrecemos: ${servicio}
- Ángulo / propuesta de valor: ${ctx.angulo ?? "más presencia y más clientes con su marketing digital"}

${channelInstruction(ctx.canal, autor)}
${langInstruction(ctx.idioma)}

REGLAS DURAS (se cumplen SÍ o SÍ)
1. HUECOS PERMITIDOS: \`[EMPRESA]\` (el nombre del negocio — usalo SIEMPRE, al menos una vez) y opcionalmente \`[NOMBRE]\` (el nombre de la persona) SOLO en el saludo. Como muchas veces no se sabe la persona, el mensaje tiene que funcionar bien apoyándose en \`[EMPRESA]\`. PROHIBIDO cualquier otro hueco (\`[DETALLE]\`, \`[X]\`, \`[CIUDAD]\`, etc.): el mensaje sale LISTO para enviar.
2. ESTRUCTURA CLÁSICA Y CLARA (nada ambiguo). En este orden:
   a) SALUDO + PRESENTACIÓN: "Hola [NOMBRE], ¿cómo estás? Soy ${autor}, de ${AGENCY.brand}." (si no hay persona, "Hola, ¿cómo están en [EMPRESA]? Soy ${autor}, de ${AGENCY.brand}"). Cordial y directo.
   b) MOTIVO CLARO: en una frase, por qué le escribís, mostrando interés genuino y mencionando a [EMPRESA] y su rubro (${ctx.rubro}). Ej: "te escribo porque trabajamos con [rubro] y me gustó lo que hacen en [EMPRESA]". Que se entienda al toque qué querés, sin vueltas.
   c) VALOR: en una frase, qué les podemos aportar, conectado a un resultado real (más clientes/consultas/ventas). Podés apoyarte en una realidad del sector, pero después de presentarte, no como apertura suelta.
   d) CIERRE: ofrecé algo concreto y gratis, sin compromiso ("si te interesa te preparo una propuesta / unas ideas para [EMPRESA] y te las paso"). PROHIBIDO pedir reunión/llamada/"charlemos" en el primer mensaje (eso va recién en el seguimiento_1).
3. CÁLIDO Y HUMANO, PERO PROLIJO. Tono cordial y profesional, como un buen comercial que escribe bien; NO frío ni robótico, NO exageradamente informal. PROHIBIDO: "espero que estés muy bien", "me pongo en contacto", "no dudes en", "potenciar", "impulsar", "llevar tu negocio al siguiente nivel", "soluciones integrales", "en el mundo digital de hoy". Nada de guiones largos (—) ni estructura de folleto. Máximo 1 emoji (o ninguno).
4. LARGO: primer mensaje y alternativa, 4 líneas cortas (5 si es email). Los seguimientos, más cortos. Si no entra, sacá palabras, no ideas.
5. Una sola idea de valor, sin lista de servicios, sin promesas mágicas, sin métricas ni casos inventados.

QUÉ ES CADA CAMPO
- "primer_mensaje": el de primer contacto, con la estructura a→d de arriba.
- "alternativa": otro primer mensaje con un ÁNGULO distinto (para A/B), mismas reglas y estructura.
- "seguimiento_1": segundo toque. Retomás con [EMPRESA], aportás algo NUEVO (otra idea o realidad del rubro). Acá SÍ podés proponer 15 minutos de charla.
- "seguimiento_2": cierre elegante. Muy corto, sin reproches, con salida fácil ("si no es el momento, sin drama").

SALIDA
Devolvé SOLO un objeto JSON válido (sin markdown ni texto extra):
{"primer_mensaje": string, "alternativa": string, "seguimiento_1": string, "seguimiento_2": string}`;

  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 1600,
    system: [{ type: "text", text: system }],
    messages: [
      { role: "user", content: "Generá la plantilla de mensajes en el JSON pedido." },
    ],
  });

  void trackAiUsage({ ruta: "prospeccion/mensajes-campana", modelo: AI_MODEL_SMART, usage: msg.usage });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return safeParse(text);
}
