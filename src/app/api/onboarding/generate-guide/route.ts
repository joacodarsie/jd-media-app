import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { extractText, getDocumentProxy } from "unpdf";
import {
  MEET_GUIDE_MODEL,
  MEET_GUIDE_SYSTEM_PROMPT,
  buildMeetGuideUserMessage,
} from "@/lib/diagnostics/meet-guide-prompt";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

/**
 * POST /api/onboarding/generate-guide
 *
 * SSE — streamea el markdown a medida que Claude lo va escribiendo.
 *
 * Multipart form-data:
 *   - cliente_id:  UUID
 *   - file:        PDF Tactiq del meet comercial (opcional si se manda transcript)
 *   - transcript:  texto plano de la transcripción (opcional si se manda file)
 *
 * Eventos:
 *   {type:"starting"}
 *   {type:"chunk", text}       cada delta de texto del modelo
 *   {type:"saving"}
 *   {type:"done", markdown}
 *   {type:"error", error}
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const form = await req.formData();
  const cliente_id = String(form.get("cliente_id") ?? "");
  if (!cliente_id) return new Response("Falta cliente_id.", { status: 400 });

  // Aceptamos PDF o texto plano.
  let transcript = String(form.get("transcript") ?? "").trim();
  const file = form.get("file");

  if (!transcript && file instanceof File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return new Response("El archivo debe ser un PDF.", { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return new Response("El PDF supera los 20 MB.", { status: 400 });
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      transcript = (Array.isArray(text) ? text.join("\n\n") : text).trim();
    } catch (err) {
      console.error("[onboarding/generate-guide] pdf parse failed", err);
      return new Response("No se pudo leer el PDF.", { status: 422 });
    }
  }

  if (!transcript || transcript.length < 200) {
    return new Response(
      "Necesito una transcripción de al menos 200 caracteres (PDF o texto pegado).",
      { status: 400 }
    );
  }
  if (transcript.length > 150_000) transcript = transcript.slice(0, 150_000);

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, rubro, pack")
    .eq("id", cliente_id)
    .maybeSingle();
  if (!client) return new Response("Cliente no encontrado.", { status: 403 });

  const admin = createAdmin();
  const { data: contratados } = await admin
    .from("client_services")
    .select("tipo")
    .eq("cliente_id", cliente_id)
    .eq("activo", true);
  const serviciosContratados = (contratados ?? [])
    .map((r: { tipo: string | null }) => r.tipo)
    .filter((x): x is string => Boolean(x));

  const userMessage = buildMeetGuideUserMessage({
    clienteNombre: client.nombre,
    rubro: (client as { rubro?: string | null }).rubro,
    pack: (client as { pack?: string | null }).pack,
    serviciosContratados,
    transcript,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* cerrado */
        }
      }, 10_000);

      try {
        send({ type: "starting" });

        let fullMarkdown = "";
        const messageStream = anthropic.messages.stream({
          model: MEET_GUIDE_MODEL,
          max_tokens: 4096,
          system: [
            {
              type: "text",
              text: MEET_GUIDE_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            fullMarkdown += chunk;
            send({ type: "chunk", text: chunk });
          }
        }
        await messageStream.finalMessage();

        if (!fullMarkdown.trim()) {
          send({ type: "error", error: "El modelo no devolvió contenido." });
          controller.close();
          return;
        }

        send({ type: "saving" });

        const now = new Date().toISOString();
        const { error: upsertErr } = await admin
          .from("client_onboarding")
          .upsert(
            {
              cliente_id,
              meet_guide_md: fullMarkdown,
              meet_guide_source_text: transcript,
              meet_guide_generated_at: now,
              meet_guide_model: MEET_GUIDE_MODEL,
            },
            { onConflict: "cliente_id" }
          );
        if (upsertErr) {
          console.error("[onboarding/generate-guide] upsert", upsertErr);
          send({ type: "error", error: "No se pudo guardar la guía." });
          controller.close();
          return;
        }

        send({ type: "done", markdown: fullMarkdown });
      } catch (err) {
        console.error("[onboarding/generate-guide] stream error", err);
        const msg = err instanceof Error ? err.message : "Error";
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
        } catch {
          /* */
        }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* */
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
