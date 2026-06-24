/**
 * Genera el PRIMER mensaje de contacto personalizado para un lead, según el
 * cluster (campaña), los datos puntuales de la empresa y el canal. La idea es un
 * mensaje corto, humano y específico (no spam): engancha con una señal real del
 * negocio, propone valor concreto y cierra con un CTA suave a una charla.
 *
 * Usa el modelo SMART porque es el mensaje que decide si cerramos o no.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { AGENCY } from "@/lib/agency";

const client = new Anthropic();

export interface LeadForMessage {
  empresa: string;
  descripcion: string | null;
  ciudad: string | null;
  pais: string | null;
  instagram: string | null;
  sitio_web: string | null;
  por_que: string | null;
  gancho: string | null;
  idea: string | null;
}

export interface MessageContext {
  rubro: string;
  servicioNombre: string | null;
  servicioDesc: string | null;
  angulo: string | null;
  canal: string; // whatsapp | instagram | email
  idioma: string; // es_ar | es | en
}

function langInstruction(idioma: string): string {
  if (idioma === "en") return "Escribí el mensaje en INGLÉS, tono profesional y cercano.";
  if (idioma === "es") return "Escribí en español NEUTRO (sin voseo argentino), tono profesional y cercano.";
  return "Escribí en español rioplatense (voseo), tono cercano y profesional, como habla un cordobés.";
}

function channelInstruction(canal: string): string {
  if (canal === "email")
    return `Es un EMAIL en frío. Empezá con una línea "Asunto: ..." breve y atractiva, después el cuerpo (4-6 líneas). Firmá como ${AGENCY.representante}, ${AGENCY.brand}.`;
  if (canal === "instagram")
    return "Es un DM de Instagram. Muy breve (3-4 líneas), informal pero profesional, sin asunto ni firma formal. Mencioná algo concreto que viste en su perfil.";
  return "Es un mensaje de WhatsApp. Breve (3-5 líneas), cálido y directo. Saludo + presentación de una línea + el gancho + CTA. Sin asunto ni firma formal (se ve el remitente).";
}

function buildSystem(ctx: MessageContext): string {
  const servicio = ctx.servicioNombre
    ? `${ctx.servicioNombre}${ctx.servicioDesc ? ` (${ctx.servicioDesc})` : ""}`
    : "marketing digital (gestión de redes, pauta, contenido)";
  return `Sos ${AGENCY.representante}, de ${AGENCY.brand}, una agencia de marketing digital de Córdoba, Argentina. Escribís el PRIMER mensaje de contacto en frío a un negocio que querés sumar como cliente.

QUÉ OFRECEMOS EN ESTA CAMPAÑA: ${servicio}.
ÁNGULO / PROPUESTA DE VALOR: ${ctx.angulo ?? "ayudarlos a tener más presencia y traerles más clientes con su marketing digital"}.

${channelInstruction(ctx.canal)}
${langInstruction(ctx.idioma)}

ESTRUCTURA (clave para que respondan)
1. ABRÍ con el GANCHO: una observación concreta y real de SU cuenta/negocio (el campo "Gancho"). Que la primera línea demuestre que miramos su perfil, no un copy genérico. Si no hay gancho, usá la señal de "Por qué"/descripción.
2. OFRECÉ VALOR CONCRETO: presentá la idea puntual que le daríamos (el campo "Idea") como algo gratis y accionable —"te armé/pensé esto para vos"—, conectado a un resultado de negocio (más clientes, reservas, ventas).
3. CTA SUAVE atado a la oferta: invitá a que le mandemos esa idea / un mini-análisis gratis, o a una charla corta de 15 min sin compromiso. La meta es que sea fácil decir "sí, contame".

REGLAS DEL MENSAJE
- Pedir una llamada en seco convierte poco: el anzuelo es el VALOR (la idea / el mini-análisis), no la reunión.
- Una sola idea de valor, no una lista de servicios. Honesto, sin promesas mágicas ni métricas inventadas.
- Nada de "estimado/a", nada robótico, nada de mayúsculas gritadas ni exceso de emojis (1 como mucho).
- Devolvé SOLO el texto del mensaje, listo para enviar. Sin comillas, sin notas, sin opciones alternativas.`;
}

function buildUser(lead: LeadForMessage): string {
  const parts = [`Empresa: ${lead.empresa}`];
  if (lead.descripcion) parts.push(`Qué hace: ${lead.descripcion}`);
  const loc = [lead.ciudad, lead.pais].filter(Boolean).join(", ");
  if (loc) parts.push(`Ubicación: ${loc}`);
  if (lead.instagram) parts.push(`Instagram: ${lead.instagram}`);
  if (lead.sitio_web) parts.push(`Web: ${lead.sitio_web}`);
  if (lead.por_que) parts.push(`Por qué es buen lead: ${lead.por_que}`);
  if (lead.gancho) parts.push(`Gancho (citá esto, es lo específico de su cuenta): ${lead.gancho}`);
  if (lead.idea) parts.push(`Idea para ofrecerle gratis: ${lead.idea}`);
  return parts.join("\n");
}

/** Devuelve el texto del mensaje, o null si la IA falla. */
export async function generateOutreachMessage(
  lead: LeadForMessage,
  ctx: MessageContext
): Promise<string | null> {
  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 700,
    system: [{ type: "text", text: buildSystem(ctx), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUser(lead) }],
  });
  const out = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return out || null;
}

/**
 * Genera el mensaje de SEGUIMIENTO para un lead que ya fue contactado y no
 * respondió. Es un segundo toque: corto, sin reproche, que aporta algo nuevo
 * (una idea concreta, un dato, una pregunta) y reabre la conversación sin sonar
 * desesperado. La conversión real vive acá.
 */
export async function generateFollowupMessage(
  lead: LeadForMessage,
  ctx: MessageContext,
  mensajeInicial: string | null
): Promise<string | null> {
  const system = `${buildSystem(ctx)}

AHORA NO es el primer mensaje: es un SEGUIMIENTO. Ya les escribiste antes y no contestaron (puede ser que no lo vieron o estaban ocupados, no que no les interese). Reglas extra del follow-up:
- Más corto todavía que el primero (2-3 líneas).
- Nada de "te escribí y no me respondiste" ni reproches ni culpa.
- Aportá algo NUEVO y concreto: una idea puntual para su negocio, un mini-dato, o una pregunta simple de sí/no que sea fácil de contestar.
- Cerrá con una salida fácil ("si no es para ustedes ahora, sin drama, avisame y listo").
- Tono relajado, humano, cordobés. 1 emoji como mucho.`;
  const prevBlock = mensajeInicial
    ? `\n\nMENSAJE QUE YA LE MANDASTE (no lo repitas, escribí algo distinto):\n${mensajeInicial}`
    : "";
  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 500,
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: buildUser(lead) + prevBlock }],
  });
  const out = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return out || null;
}
