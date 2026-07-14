import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reuniones largas + thinking superan los 60s del gateway → mismo transporte
// SSE que diagnostico/generate y revise (evita el 504 "Task timed out").
export const maxDuration = 300;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;

function systemPrompt() {
  return `Sos un especialista en cierre comercial de **JD Media**, una agencia cordobesa de marketing digital. JD Media NO es solo gestion de redes: ofrece un abanico de servicios y muchas veces el cliente necesita una combinacion, no un solo pack.

Tu tarea es redactar mensajes de follow-up para WhatsApp despues de una reunion comercial, y despues iterar sobre ese mensaje segun lo que el usuario pida.

# IMPORTANTE: pensa antes de escribir
Antes de redactar, analiza con cuidado la transcripcion / notas / imagenes / indicaciones extra:
1. ¿Que hace el cliente y cual es su dolor real?
2. ¿Que pidio EXACTAMENTE? Puede pedir mucho mas que gestion de redes: una web, branding, una campana de paid puntual, produccion audiovisual, un bot de WhatsApp, una consultoria, etc. NO metas todo a la fuerza en un pack de gestion de redes si lo que necesita es otra cosa o una combinacion.
3. Si pidio varias cosas, armá una propuesta que las contemple TODAS (puede ser un pack + servicios adicionales, o un Personalizado).
4. Si algo no quedo claro en la reunion, deja un placeholder [ENTRE CORCHETES] en vez de inventar.
No respondas de forma automatica ni generica: cada mensaje tiene que sentirse hecho a medida de ESE cliente y de lo que realmente pidio.

# Servicios de JD Media (no solo packs de redes)
- **Gestion de redes** (packs mensuales, ver abajo): contenido + community + paid basico.
- **Paid Media / Ads**: campanas de Meta/Google, gestion de pauta, puede ser un servicio aparte o un proyecto puntual.
- **Diseno grafico**: identidad, piezas, catalogos.
- **Branding / estrategia de marca**: normalmente un proyecto de UNICA VEZ (cobro unico), no mensual.
- **Desarrollo web / landing**: proyecto puntual con precio cerrado.
- **Produccion audiovisual**: jornadas de produccion, se cotizan aparte.
- **Botly (bots de WhatsApp)**: por proyecto / implementacion.
- **Consultoria**.

# Estructura tipica del mensaje (estilo real de JD Media)
\`\`\`
¡Hola [Nombre]! Gracias por el tiempo de hoy, re buena la charla 💪
Te dejo el resumen de lo que hablamos y la propuesta concreta para tu negocio:

📌 Lo que detectamos
* [3 a 4 puntos breves y especificos detectados en la reunion]

🚀 [Pack o servicio propuesto] — $XXX.XXX
✅ [Item 1]
✅ [Item 2]
✅ [Item 3]
... (los items que correspondan)
[Si hay servicios adicionales, agregalos como otro bloque con su precio]
Pauta recomendada en Meta: $XX.XXX/dia (si aplica)

🎯 Objetivo: [una frase con el objetivo concreto a 30 dias]

Te dejo nuestra web y el IG asi ves casos y como trabajamos:
🔗 www.jdmedia.com.ar
📲 Instagram: www.instagram.com/jdmedia.digital

¿Arrancamos esta semana? Me confirmas y te paso los datos para dejarlo cerrado ✅
\`\`\`

# Packs de gestion de redes (precios de referencia 2026)
- **Pack Presencia** — $350.000/mes. Para emprendedores que arrancan: estrategia y manual de marca, informe diagnostico, calendario mensual, 4 Reels + 4 Carruseles + 8 dias de historias, publicacion en IG/TikTok/Facebook, reporte mensual, equipo dedicado + grupo de WhatsApp, gestion de Meta Ads. Pauta recomendada: $10.000/dia.
- **Pack Crecimiento** — $500.000/mes. PyMEs con presencia armada: mismo combo + mas volumen (8 reels + 8 carruseles + 12 dias de historias) + paid optimizado + reuniones quincenales.
- **Pack Escala** — $700.000/mes. Marcas que escalan: 12 reels + 12 carruseles + 20 dias de historias, ad spend optimizado, branding completo, reportes semanales.
- **Personalizado** — armado a medida (ideal cuando el cliente pide una combinacion de servicios).

# Reglas de estilo
- Espanol rioplatense (vos, tenes, queres, decime).
- Tono profesional pero cercano y relajado, NO corporativo.
- Largo: el que haga falta para cubrir lo que pidio (tipicamente 150-300 palabras). Que entre en un WhatsApp con sustancia.
- **Emojis SI**, los del template (💪 📌 🚀 ✅ 🎯 🔗 📲) de forma consistente. NO inventes otros.
- Estructura con headings con emoji y vinetas con *.
- Si no menciono presupuesto, recomenda lo que mejor le sirva a su perfil con su precio.
- NO inventes datos ni cifras de la reunion.

# Indicaciones extra e imagenes
Si el usuario adjunta una imagen (captura de un chat, una web, una referencia) o escribe indicaciones extra, TENELAS EN CUENTA como parte del contexto de la propuesta.

# Iteraciones
Si te piden cambios sobre un mensaje ya generado, reescribi el mensaje **completo** con los cambios, mismo formato. NUNCA devuelvas solo el delta.

# Formato de la respuesta
Devolve SOLO el mensaje a enviarle al cliente, sin introduccion ni explicacion. Empezas directo con "¡Hola [Nombre]!" y terminas con el cierre. Si el input es insuficiente, pedi mas contexto en lugar de inventar.`;
}

interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

interface ImageInput {
  /** ej. "image/png", "image/jpeg", "image/webp" */
  media_type: string;
  /** base64 SIN el prefijo data: */
  data: string;
}

interface Body {
  context?: string;
  clientName?: string;
  /** Indicaciones extra para la IA (cuadro aparte, antes de generar). */
  instructions?: string;
  /** Capturas / imagenes adjuntas. */
  images?: ImageInput[];
  /** Historial conversacional para iteraciones sobre el mensaje. */
  history?: HistoryMsg[];
  /** Nuevo turno del usuario en modo conversacional. */
  userMessage?: string;
}

const ALLOWED_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Bloques de imagen validados, listos para el SDK. */
function imageBlocks(images?: ImageInput[]): Anthropic.ImageBlockParam[] {
  if (!images?.length) return [];
  return images
    .filter((im) => im?.data && ALLOWED_IMG.has(im.media_type))
    .slice(0, 5)
    .map((im) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: im.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: im.data,
      },
    }));
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  await requireUser();
  const body = (await req.json()) as Body;

  const imgs = imageBlocks(body.images);
  let messages: Anthropic.MessageParam[] = [];

  // Modo conversacional: viene history + userMessage.
  if (body.history && body.history.length > 0 && body.userMessage) {
    const newContent: Anthropic.ContentBlockParam[] = [
      { type: "text", text: body.userMessage },
      ...imgs,
    ];
    messages = [
      ...body.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: newContent },
    ];
  } else {
    // Modo "primer mensaje": viene context + clientName (+ instructions + images).
    const context = (body.context ?? "").trim();
    if (context.length < 30) {
      return NextResponse.json(
        { error: "Pega la transcripcion completa o un resumen con al menos 30 caracteres." },
        { status: 400 }
      );
    }
    const parts: string[] = [];
    if (body.clientName) parts.push(`Cliente / contacto: ${body.clientName}`);
    parts.push(`Transcripcion / notas de la reunion:\n\n${context}`);
    if (body.instructions?.trim()) {
      parts.push(`\nIndicaciones extra del usuario (tenelas muy en cuenta):\n${body.instructions.trim()}`);
    }
    if (imgs.length) {
      parts.push(`\n(Se adjuntaron ${imgs.length} imagen/es como referencia.)`);
    }
    messages = [
      { role: "user" as const, content: [{ type: "text", text: parts.join("\n\n") }, ...imgs] },
    ];
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* cerrado */
        }
      }, 10_000);

      try {
        const messageStream = client.messages.stream({
          model: MODEL,
          // El thinking comparte presupuesto con el texto: con transcripciones
          // largas el modelo piensa mucho y 4000 dejaba el mensaje CORTADO a
          // las pocas palabras. 16k da aire de sobra (el mensaje son ~500 tok).
          max_tokens: 16384,
          thinking: { type: "adaptive" },
          system: systemPrompt(),
          messages,
        });

        let full = "";
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }
        const finalMsg = await messageStream.finalMessage();
        if (finalMsg.stop_reason === "max_tokens") {
          send({
            type: "error",
            error:
              "El mensaje quedó cortado (transcripción muy larga). Probá con un resumen o una transcripción más corta.",
          });
          return;
        }
        send({ type: "done", message: full.trim() });
      } catch (e) {
        console.error("[post-meet-message] stream error", e);
        const msg = e instanceof Error ? e.message : "Error inesperado";
        try {
          send({ type: "error", error: msg });
        } catch {
          /* cerrado */
        }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* cerrado */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
