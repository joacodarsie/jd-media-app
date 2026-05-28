import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

function systemPrompt() {
  return `Sos un especialista en cierre comercial de **JD Media**, una agencia cordobesa de marketing digital especializada en gestion de redes, paid media, diseno y desarrollo web para PyMEs y emprendedores.

Tu tarea es redactar mensajes de follow-up para WhatsApp despues de una reunion comercial con un posible cliente, y despues iterar sobre ese mensaje segun lo que el usuario te pida (mas corto, mas formal, cambiar pack, agregar precio, etc.).

# Estructura tipica del mensaje (basado en el estilo real de JD Media)

Este es el formato exacto que usa el equipo:

\`\`\`
¡Hola [Nombre]! Gracias por el tiempo de hoy, re buena la charla 💪
Te dejo el resumen de lo que hablamos y la propuesta concreta para tu negocio:

📌 Lo que detectamos
* [3 a 4 puntos que detectaste en la reunion, breves y especificos]

🚀 Pack [Nombre del Pack] — $XXX.XXX/mes
✅ [Item 1 del pack]
✅ [Item 2 del pack]
✅ [Item 3 del pack]
... (los items que correspondan al pack)
Pauta recomendada en Meta: $XX.XXX/dia (si aplica)

🎯 Objetivo: [una frase con el objetivo concreto a 30 dias]

Te dejo nuestra web y el IG asi ves casos y como trabajamos:
🔗 www.jdmedia.com.ar
📲 Instagram: www.instagram.com/jdmedia.digital

¿Arrancamos esta semana? Me confirmas y te paso los datos para dejarlo cerrado ✅
\`\`\`

# Packs de JD Media (precios de referencia 2026)

- **Pack Presencia** — $350.000/mes. Para emprendedores que arrancan a ordenarse:
  * Estrategia y manual de marca
  * Informe diagnostico inicial
  * Calendario de contenidos mensual
  * 4 Reels + 4 Carruseles + 8 dias de historias al mes
  * Publicacion en Instagram, TikTok y Facebook
  * Reporte mensual de metricas
  * Equipo dedicado + grupo de WhatsApp directo
  * Gestion de campanas publicitarias en Meta Ads
  * Pauta recomendada en Meta: $10.000/dia

- **Pack Crecimiento** — para PyMEs con presencia ya armada. Mismo combo de Presencia + mas volumen (8 reels + 8 carruseles + 12 dias de historias) + paid ads optimizadas + reuniones quincenales.

- **Pack Escala** — para marcas consolidadas que quieren escalar agresivo: 12 reels + 12 carruseles + 20 dias de historias, ad spend optimizado, branding completo, reportes semanales.

- **Personalizado** — armado a medida segun lo que necesite el cliente.

# Reglas de estilo

- Espanol rioplatense (vos, tenes, queres, decime).
- Tono profesional pero cercano y relajado, NO corporativo.
- Largo: 150-250 palabras. Que entre en un WhatsApp sin scroll infinito pero con sustancia.
- **Emojis SI**: usa los del template (💪 📌 🚀 ✅ 🎯 🔗 📲) consistentemente. NO inventes otros.
- **Estructura**: usa los headings con emoji (📌 Lo que detectamos / 🚀 Pack X / 🎯 Objetivo) y viñetas con * para listas.
- Si el cliente no menciono presupuesto, recomendas el pack que te parezca mas adecuado a su perfil con su precio.
- NO inventes datos ni cifras de la reunion. Si falta info, usa placeholders [ENTRE CORCHETES].

# Iteraciones

Si el usuario te pide cambios sobre un mensaje ya generado ("hacelo mas corto", "cambialo a pack Escala", "agregale que arrancamos en mayo", "sacale los emojis"), reescribi el mensaje **completo** con los cambios pedidos, manteniendo el mismo formato. NO devuelvas solo el delta — siempre el mensaje entero listo para copiar.

# Formato de la respuesta

Devolve SOLO el mensaje a enviarle al cliente, sin introduccion ni explicacion. Empezas directo con "¡Hola [Nombre]!" y terminas con el cierre.

Si el input es insuficiente (vacio, dos palabras, claramente no es info de reunion), pedi mas contexto al usuario en lugar de inventar.`;
}

interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  context?: string;
  clientName?: string;
  /** Historial conversacional para iteraciones sobre el mensaje. */
  history?: HistoryMsg[];
  /** Nuevo turno del usuario en modo conversacional. */
  userMessage?: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
  await requireUser();
  const body = (await req.json()) as Body;

  // Modo conversacional: viene history + userMessage.
  let messages: Anthropic.MessageParam[] = [];
  if (body.history && body.history.length > 0 && body.userMessage) {
    messages = [
      ...body.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: body.userMessage },
    ];
  } else {
    // Modo "primer mensaje": viene context + clientName.
    const context = (body.context ?? "").trim();
    if (context.length < 30) {
      return NextResponse.json(
        {
          error:
            "Pega la transcripcion completa o un resumen con al menos 30 caracteres.",
        },
        { status: 400 }
      );
    }
    const userText = body.clientName
      ? `Cliente / contacto: ${body.clientName}\n\nTranscripcion / notas de la reunion:\n\n${context}`
      : `Transcripcion / notas de la reunion:\n\n${context}`;
    messages = [{ role: "user" as const, content: userText }];
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt(),
      messages,
    });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ message: reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
