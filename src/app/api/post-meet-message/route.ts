import { trackAiUsage } from "@/lib/ai/usage";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { createAdmin } from "@/lib/supabase/admin";
import { packsParaPrompt } from "@/lib/agency/packs-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reuniones largas + thinking superan los 60s del gateway → mismo transporte
// SSE que diagnostico/generate y revise (evita el 504 "Task timed out").
export const maxDuration = 300;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;

/**
 * Packs con sus precios REALES, leídos de la base (que se sincroniza sola con
 * jdmedia.com.ar). Antes estaban escritos acá a mano y quedaron desactualizados:
 * el prompt cotizaba $350.000 el Presencia cuando la web ya decía $400.000.
 *
 * Si la tabla todavía no existe o está vacía, se cae al texto de respaldo con
 * los precios verificados el 2026-08-05 — nunca a un prompt sin precios.
 */
async function bloquePacks(): Promise<string> {
  const FALLBACK = `- **Pack Presencia** — $400.000/mes. 4 reels + 4 posts + 8 dias de historias.
- **Pack Crecimiento** — $600.000/mes. 8 reels + 8 posts + 12 dias de historias.
- **Pack Escala** — $800.000/mes. 12 reels + 12 posts + 20 dias de historias.
- **Pack Personalizado** — a cotizar segun el caso.`;

  try {
    const { data, error } = await createAdmin()
      .from("agency_packs")
      .select("slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden")
      .order("orden");
    if (error || !data || data.length === 0) return FALLBACK;
    return packsParaPrompt(
      (data as Record<string, unknown>[]).map((p) => ({
        slug: String(p.slug),
        nombre: String(p.nombre),
        precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
        descripcion: p.descripcion === null ? null : String(p.descripcion),
        reels: p.reels === null ? null : Number(p.reels),
        posts: p.posts === null ? null : Number(p.posts),
        dias_historias: p.dias_historias === null ? null : Number(p.dias_historias),
        orden: Number(p.orden ?? 0),
      }))
    );
  } catch {
    return FALLBACK;
  }
}

function systemPrompt(packs: string) {
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

# Packs de gestion de redes (PRECIOS VIGENTES, sincronizados con jdmedia.com.ar)
${packs}

Todos los packs incluyen: estrategia y manual de marca, informe diagnostico, calendario mensual, publicacion en IG/Facebook/TikTok, rediseno de perfiles, reporte mensual, equipo dedicado con grupo de WhatsApp y gestion de campanas en Meta Ads. Pauta recomendada aparte: $10.000/dia.

⚠️ Usa EXACTAMENTE estos precios. Son los que figuran en la web y los que el cliente va a ver si entra. NUNCA inventes ni redondees un precio distinto.

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
        // Los precios se leen en cada corrida: si se sincronizaron con la web
        // hace un rato, la propuesta sale con el precio de hoy.
        const packs = await bloquePacks();

        const messageStream = client.messages.stream({
          model: MODEL,
          // El thinking comparte presupuesto con el texto: con transcripciones
          // largas el modelo piensa mucho y 4000 dejaba el mensaje CORTADO a
          // las pocas palabras. 16k da aire de sobra (el mensaje son ~500 tok).
          max_tokens: 16384,
          thinking: { type: "adaptive" },
          system: systemPrompt(packs),
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
        void trackAiUsage({ ruta: "post-meet-message", modelo: MODEL, usage: finalMsg.usage });
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
