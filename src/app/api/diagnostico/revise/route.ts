import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  DIAGNOSTIC_GENERATOR_MODEL,
  DIAGNOSTIC_SYSTEM_PROMPT,
  DIAGNOSTIC_FEW_SHOT,
  SAVE_DIAGNOSTIC_TOOL,
  buildReviseUserMessage,
} from "@/lib/diagnostics/generate-prompt";
import { isDiagnosticShape, normalizeDiagnostic, type DiagnosticContent } from "@/lib/diagnostics/schema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

const OK_IMAGE_MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGES = 6;

type IncomingImage = { media_type: string; data: string };

/**
 * POST /api/diagnostico/revise
 *
 * Revisa un diagnóstico APROBADO en base a las correcciones del cliente y guarda
 * una VERSIÓN NUEVA en draft (el admin la revisa y la aprueba → nuevo PDF).
 * Mismo transporte SSE que /generate (evita el 504 del gateway).
 *
 * Body JSON: {
 *   cliente_id, base_diagnostic_id,
 *   correcciones: string,           // texto + lo transcripto de audios
 *   images?: { media_type, data }[] // capturas (base64) → visión de Anthropic
 * }
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    cliente_id?: string;
    base_diagnostic_id?: string;
    correcciones?: string;
    images?: IncomingImage[];
  } | null;

  if (!body?.cliente_id || !body.base_diagnostic_id) {
    return new Response("Faltan cliente_id o base_diagnostic_id.", { status: 400 });
  }

  const correcciones = (body.correcciones ?? "").trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!correcciones && images.length === 0) {
    return new Response("Cargá al menos una corrección (texto, audio o captura).", { status: 400 });
  }
  for (const img of images) {
    if (!OK_IMAGE_MEDIA.has(img?.media_type)) {
      return new Response("Formato de imagen no soportado (usá PNG, JPG, WEBP o GIF).", { status: 400 });
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", body.cliente_id)
    .maybeSingle();
  if (!client) return new Response("Cliente no encontrado.", { status: 403 });

  const admin = createAdmin();

  // Tomamos el diagnóstico base (debe ser del mismo cliente).
  const { data: base } = await admin
    .from("client_diagnostics")
    .select("id, cliente_id, content")
    .eq("id", body.base_diagnostic_id)
    .maybeSingle();
  if (!base || base.cliente_id !== body.cliente_id) {
    return new Response("Diagnóstico base no encontrado.", { status: 404 });
  }

  const currentContentJson = JSON.stringify(base.content, null, 2);
  const userText = buildReviseUserMessage({
    clienteNombre: client.nombre,
    currentContentJson,
    correcciones,
    imageCount: images.length,
  });

  // El mensaje del user = texto + imágenes (bloques de visión).
  const userContent: Anthropic.MessageParam["content"] = [
    { type: "text", text: userText },
    ...images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: img.data,
        },
      })
    ),
  ];

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
        send({ type: "starting" });

        let toolInputRaw = "";
        let bytesIn = 0;

        const messageStream = anthropic.messages.stream({
          model: DIAGNOSTIC_GENERATOR_MODEL,
          max_tokens: 16384,
          system: [
            { type: "text", text: DIAGNOSTIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            { type: "text", text: DIAGNOSTIC_FEW_SHOT, cache_control: { type: "ephemeral" } },
          ],
          tools: [SAVE_DIAGNOSTIC_TOOL],
          tool_choice: { type: "tool", name: "save_diagnostic" },
          messages: [{ role: "user", content: userContent }],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            toolInputRaw += event.delta.partial_json;
            bytesIn += event.delta.partial_json.length;
            if (bytesIn % 200 < 50) send({ type: "progress", chars: bytesIn });
          }
        }

        const finalMsg = await messageStream.finalMessage();
        if (finalMsg.stop_reason === "max_tokens") {
          send({
            type: "error",
            error: "El informe quedó demasiado largo y se cortó. Probá de nuevo con menos correcciones a la vez.",
          });
          controller.close();
          return;
        }

        let toolInput: unknown;
        try {
          toolInput = JSON.parse(toolInputRaw);
        } catch {
          send({ type: "error", error: "El modelo devolvió JSON inválido." });
          controller.close();
          return;
        }

        toolInput = normalizeDiagnostic(toolInput);
        if (!isDiagnosticShape(toolInput)) {
          console.error("[diagnostico/revise] invalid shape", toolInput);
          send({ type: "error", error: "Estructura del diagnóstico inválida." });
          controller.close();
          return;
        }
        const content = toolInput as DiagnosticContent;

        send({ type: "saving" });

        const { data: versionRow, error: versionErr } = await admin.rpc("next_diagnostic_version", {
          p_cliente: body.cliente_id!,
        });
        if (versionErr || typeof versionRow !== "number") {
          send({ type: "error", error: "No se pudo calcular versión." });
          controller.close();
          return;
        }

        const { data: inserted, error: insertErr } = await admin
          .from("client_diagnostics")
          .insert({
            cliente_id: body.cliente_id,
            version: versionRow,
            status: "draft",
            content: content as unknown as Record<string, unknown>,
            // Guardamos las correcciones aplicadas como rastro en transcript_text.
            transcript_text: `[Revisión v${versionRow} — correcciones del cliente]\n\n${correcciones}${
              images.length > 0 ? `\n\n(+${images.length} captura(s) adjunta(s))` : ""
            }`,
            generated_with_model: DIAGNOSTIC_GENERATOR_MODEL,
            generated_at: new Date().toISOString(),
            created_by: user.id,
          })
          .select("id, version")
          .single();

        if (insertErr || !inserted) {
          console.error("[diagnostico/revise] insert error", insertErr);
          send({ type: "error", error: "No se pudo guardar la revisión." });
          controller.close();
          return;
        }

        send({ type: "done", id: inserted.id, version: inserted.version, content });
      } catch (err) {
        console.error("[diagnostico/revise] stream error", err);
        const msg = err instanceof Error ? err.message : "Error en la revisión.";
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
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
