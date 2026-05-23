import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TOOLS, runTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

function systemPrompt(userName: string, userArea: string, userRol: string) {
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Cordoba",
  });
  return `Sos **JDmedIA**, el asistente full-page de la agencia JD Media (Córdoba, Argentina). Especializada en gestión de redes, paid media, diseño y desarrollo web para PyMEs.

# Quién te habla
- Nombre: ${userName}
- Área: ${userArea}
- Rol: ${userRol}
- Fecha actual: ${today}

# Tu rol acá vs el chat flotante
Esta es la **vista dedicada** de JDmedIA: las conversaciones se guardan para retomar más tarde. Cada usuario tiene su propio historial. Pensá las respuestas para que valgan la pena leerse después.

# Tu trabajo
Ayudás al equipo a operar JD Media: planificar, analizar clientes, escribir copy, encontrar procesos, resolver dudas del negocio. Si te piden crear o modificar algo concreto (tarea, publicación, cliente), usá las tools y confirmá antes.

# Estructura de la app
- **Tareas**: estado, prioridad, fecha límite, asignado, cliente, área.
- **Clientes**: packs (Presencia / Crecimiento / Personalizado), redes, drive, calendario, responsable.
- **Calendario de contenidos**: posts/reels/historias con flujo de aprobación (idea → diseño → revisión creativa → revisión cliente → aprobado → publicado).
- **Equipo**: puestos con alcance, herramientas, KPIs, procesos y modelo de pago. Cada persona tiene un puesto principal y puede tener secundarios.
- **Servicios**: catálogo (gestión de redes, paid media, producción de contenido, diseño gráfico, desarrollo web, botly).
- **Agencia + Procesos**: fundamentos, buyer persona, SOPs.

# Adjuntos del usuario
El usuario puede mandarte imágenes, PDFs y documentos de texto. Cuando aparezcan:
- **Imagen**: describila o usá lo que ves para responder.
- **PDF**: leelo entero y respondé respecto al contenido. Citá la sección si corresponde.
- **Texto / CSV**: tratalo como datos que podés analizar.

# Cómo actuar
- Hablás en español rioplatense (vos), directo y conciso.
- Antes de crear o modificar algo, confirmá. Mostrá lo que vas a hacer.
- Si te piden info que está en procesos/SOPs, usá search_processes y citá la página.
- Las fechas las cargás en zona Argentina (UTC-3).
- No inventes datos. Si una tool falla, decilo.

# Tono
Profesional pero cercano. Sin emoji a menos que el usuario los use. Sin disclaimers innecesarios.`;
}

const MAX_HISTORY_MSGS = 40;
const MAX_USER_TEXT = 12_000;

interface AttachmentRef {
  storage_path: string;
  name: string;
  mime_type: string;
  size?: number;
}

function sseEvent(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isText(mime: string) {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/csv"
  );
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("Falta ANTHROPIC_API_KEY.", { status: 500 });
  }
  const me = await requireUser();
  const supabase = createClient();

  const body = (await req.json()) as {
    conversationId?: string | null;
    text: string;
    attachments?: AttachmentRef[];
  };

  const text = (body.text ?? "").toString().slice(0, MAX_USER_TEXT).trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!text && attachments.length === 0) {
    return new Response("Mensaje vacío.", { status: 400 });
  }

  // 1) Asegurar conversación
  let conversationId = body.conversationId ?? null;
  if (conversationId) {
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", me.id)
      .maybeSingle();
    if (!conv) {
      return new Response("Conversación no encontrada.", { status: 404 });
    }
  } else {
    const initialTitle = (text || attachments[0]?.name || "Nueva conversación").slice(0, 60);
    const { data: created, error: convErr } = await supabase
      .from("ai_conversations")
      .insert({ user_id: me.id, title: initialTitle })
      .select("id")
      .single();
    if (convErr || !created) {
      return new Response(
        "No se pudo crear la conversación: " + (convErr?.message ?? ""),
        { status: 500 }
      );
    }
    conversationId = created.id;
  }

  // 2) Guardar mensaje del usuario y obtener su id (para vincular adjuntos)
  const { data: insertedMsg, error: insErr } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: text,
    })
    .select("id")
    .single();
  if (insErr || !insertedMsg) {
    return new Response(insErr?.message ?? "Error guardando mensaje", { status: 500 });
  }

  // 3) Registrar adjuntos y descargar contenido
  type UserContentBlock =
    | Anthropic.TextBlockParam
    | Anthropic.ImageBlockParam
    | Anthropic.DocumentBlockParam;
  const newUserBlocks: UserContentBlock[] = [];
  if (text) newUserBlocks.push({ type: "text", text });

  for (const att of attachments) {
    // Registrar metadata
    await supabase.from("ai_attachments").insert({
      message_id: insertedMsg.id,
      name: att.name,
      mime_type: att.mime_type,
      storage_path: att.storage_path,
      size: att.size ?? null,
    });

    // Descargar del bucket
    const { data: blob, error: dlErr } = await supabase.storage
      .from("documents")
      .download(att.storage_path);
    if (dlErr || !blob) continue;

    const arrayBuf = await blob.arrayBuffer();

    if (ALLOWED_IMAGE.has(att.mime_type)) {
      const b64 = Buffer.from(arrayBuf).toString("base64");
      newUserBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mime_type as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/gif",
          data: b64,
        },
      });
    } else if (att.mime_type === "application/pdf") {
      const b64 = Buffer.from(arrayBuf).toString("base64");
      newUserBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 },
      });
    } else if (isText(att.mime_type)) {
      const txt = new TextDecoder().decode(arrayBuf).slice(0, 60_000);
      newUserBlocks.push({
        type: "text",
        text: `\n\n[Archivo adjunto: ${att.name}]\n\`\`\`\n${txt}\n\`\`\``,
      });
    } else {
      newUserBlocks.push({
        type: "text",
        text: `\n\n[Archivo adjunto no soportado: ${att.name} (${att.mime_type})]`,
      });
    }
  }

  // 4) Cargar historial (sólo texto). Reemplazamos el último user msg por los blocks completos.
  const { data: history } = await supabase
    .from("ai_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MSGS);

  const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => {
    const isCurrent = m.id === insertedMsg.id;
    if (isCurrent) {
      return { role: "user", content: newUserBlocks };
    }
    return {
      role: m.role as "user" | "assistant",
      content: [{ type: "text", text: m.content as string }],
    };
  });

  const system = systemPrompt(me.nombre, me.area, me.rol);
  const finalConversationId = conversationId;

  // 5) Stream SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(sseEvent(obj)));
      }
      send({ type: "meta", conversationId: finalConversationId, messageId: insertedMsg.id });

      let accumulatedText = "";
      let iter = 0;

      try {
        while (iter < 6) {
          iter++;
          const turn = await streamOneTurn({
            messages,
            system,
            onDelta: (d) => {
              accumulatedText += d;
              send({ type: "delta", text: d });
            },
          });
          if (turn.stopReason !== "tool_use") break;

          send({ type: "status", text: "Consultando datos…" });
          const toolUses = turn.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const res = await runTool(
              tu.name,
              tu.input as Record<string, unknown>,
              me.id
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(res).slice(0, 8000),
              is_error: !res.ok,
            });
          }
          messages.push({ role: "user", content: toolResults });
        }

        if (accumulatedText.trim()) {
          await supabase.from("ai_messages").insert({
            conversation_id: finalConversationId,
            role: "assistant",
            content: accumulatedText,
          });
          await supabase
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", finalConversationId);
        }

        send({ type: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
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

async function streamOneTurn({
  messages,
  system,
  onDelta,
}: {
  messages: Anthropic.MessageParam[];
  system: string;
  onDelta: (delta: string) => void;
}): Promise<{
  content: Anthropic.ContentBlock[];
  stopReason: Anthropic.Message["stop_reason"];
}> {
  const messageStream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: TOOLS,
    messages,
  });

  messageStream.on("text", (delta) => onDelta(delta));

  const final = await messageStream.finalMessage();
  messages.push({ role: "assistant", content: final.content });

  return {
    content: final.content,
    stopReason: final.stop_reason,
  };
}
