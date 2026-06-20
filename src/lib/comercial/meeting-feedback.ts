/**
 * Coach de ventas: toma la transcripción de una reunión comercial y devuelve
 * feedback accionable para que el vendedor mejore CÓMO da esas reuniones.
 * On-demand (lo dispara el equipo comercial desde /comercial/feedback).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";

const client = new Anthropic();

const SYSTEM = `Sos un coach de ventas senior que entrena al equipo comercial de JD Media (agencia de marketing digital de Córdoba, Argentina, que vende gestión de redes, diseño, edición, pauta y desarrollo web a pymes y emprendedores). Te paso la transcripción de una reunión comercial (primer contacto o cierre) entre un vendedor de JD Media y un prospecto.

Tu trabajo es darle al vendedor un feedback HONESTO y ACCIONABLE para que mejore cómo da estas reuniones. Sos un coach, no un resumidor: analizá la técnica de venta.

Escribí en español rioplatense (vos), en markdown, con estas secciones:

## Resumen
2-3 líneas: cómo estuvo la reunión y si encaminó hacia el cierre.

## Lo que estuvo bien
Bullets concretos de momentos o frases que sumaron.

## A mejorar
Bullets con momentos puntuales del estilo: "Cuando el cliente dijo «...», respondiste «...»; convenía «...» porque...". Citá la parte de la charla.

## Qué deberías haber dicho / no dicho
- Acá tendrías que haber dicho... (con la frase sugerida concreta)
- Acá no convenía mencionar... (y por qué)

## Próximos pasos
Qué hacer en el follow-up para avanzar el cierre.

Reglas estrictas:
- Basate SOLO en la transcripción. No inventes datos, montos ni dichos.
- Directo pero constructivo: es para entrenar, no para funar.
- Foco en técnica de venta: descubrimiento de necesidades, escucha, manejo de objeciones, propuesta de valor, comunicación del precio, cierre y próximos pasos.
- Si la transcripción es muy corta o no parece una reunión comercial, decilo con franqueza y no inventes un análisis.
- Solo el feedback en markdown, sin texto extra alrededor.`;

export async function generateMeetingFeedback(
  transcript: string
): Promise<string | null> {
  const t = transcript.trim();
  if (t.length < 80) return null;
  try {
    const msg = await client.messages.create({
      model: AI_MODEL_SMART,
      max_tokens: 1800,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: `Transcripción de la reunión comercial:\n\n${t}` },
      ],
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
