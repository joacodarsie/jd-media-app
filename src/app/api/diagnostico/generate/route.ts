import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  DIAGNOSTIC_GENERATOR_MODEL,
  DIAGNOSTIC_SYSTEM_PROMPT,
  DIAGNOSTIC_FEW_SHOT,
  SAVE_DIAGNOSTIC_TOOL,
  buildGenerateUserMessage,
} from "@/lib/diagnostics/generate-prompt";
import { isDiagnosticShape, normalizeDiagnostic, type DiagnosticContent } from "@/lib/diagnostics/schema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

/**
 * POST /api/diagnostico/generate
 *
 * Streaming SSE — devuelve eventos hasta el resultado final.
 * Necesario porque el gateway de Vercel mata conexiones síncronas a ~60s,
 * y la generación del informe puede tardar 60-90s.
 *
 * Eventos:
 *   {type:"starting"}              al arrancar
 *   {type:"progress", chars:n}     cada vez que llegan deltas de la tool
 *   {type:"saving"}                cuando empieza a guardar en DB
 *   {type:"done", id, version, content}  resultado
 *   {type:"error", error}          cualquier error
 *
 * Body JSON: { cliente_id, transcript_text, source_pdf_path }
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    cliente_id?: string;
    transcript_text?: string;
    source_pdf_path?: string | null;
    instrucciones?: string | null;
  } | null;

  if (!body?.cliente_id || !body.transcript_text) {
    return new Response("Faltan cliente_id o transcript_text.", { status: 400 });
  }
  if (body.transcript_text.length < 200) {
    return new Response("Transcripción muy corta.", { status: 400 });
  }
  const transcript =
    body.transcript_text.length > 150_000
      ? body.transcript_text.slice(0, 150_000)
      : body.transcript_text;

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, rubro, pack, redes_sociales")
    .eq("id", body.cliente_id)
    .maybeSingle();
  if (!client) {
    return new Response("Cliente no encontrado.", { status: 403 });
  }

  const admin = createAdmin();

  const { data: contratados } = await admin
    .from("client_services")
    .select("tipo")
    .eq("cliente_id", body.cliente_id)
    .eq("activo", true);
  const serviciosContratados = (contratados ?? [])
    .map((row: { tipo: string | null }) => row.tipo)
    .filter((x): x is string => Boolean(x));

  const redes: { red: string; handle?: string | null }[] = [];
  const r = (client as { redes_sociales?: unknown }).redes_sociales;
  if (Array.isArray(r)) {
    for (const item of r) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const red = typeof obj.red === "string" ? obj.red : null;
        const handle = typeof obj.handle === "string" ? obj.handle : null;
        if (red) redes.push({ red, handle });
      }
    }
  }

  const instrucciones =
    typeof body.instrucciones === "string" ? body.instrucciones.slice(0, 4000) : null;

  // Contexto complementario: la transcripción del meet COMERCIAL (la que se
  // cargó para generar la guía de onboarding). Enriquece el diagnóstico con
  // lo que el cliente ya dijo en la venta.
  const { data: onbRow } = await admin
    .from("client_onboarding")
    .select("meet_guide_source_text")
    .eq("cliente_id", body.cliente_id)
    .maybeSingle();
  const comercialTranscript =
    (onbRow as { meet_guide_source_text?: string | null } | null)
      ?.meet_guide_source_text ?? null;

  const userMessage = buildGenerateUserMessage({
    clienteNombre: client.nombre,
    rubro: (client as { rubro?: string | null }).rubro,
    pack: (client as { pack?: string | null }).pack,
    serviciosContratados,
    redes,
    transcript,
    comercialTranscript,
    instrucciones,
  });

  // SSE stream — la clave para evitar el 504 del gateway.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // Heartbeat cada 10s para que el proxy nunca cierre por inactividad.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream cerrado */
        }
      }, 10_000);

      try {
        send({ type: "starting" });

        // Stream de Anthropic. Concatenamos los deltas de input_json para
        // reconstruir el JSON de la tool call.
        let toolInputRaw = "";
        let bytesIn = 0;

        const messageStream = anthropic.messages.stream({
          model: DIAGNOSTIC_GENERATOR_MODEL,
          // El diagnóstico tiene 14 secciones; 8192 truncaba el JSON de la tool
          // y rompía el JSON.parse ("estructura inválida"). Damos margen amplio.
          max_tokens: 16384,
          system: [
            {
              type: "text",
              text: DIAGNOSTIC_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: DIAGNOSTIC_FEW_SHOT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [SAVE_DIAGNOSTIC_TOOL],
          tool_choice: { type: "tool", name: "save_diagnostic" },
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "input_json_delta"
          ) {
            toolInputRaw += event.delta.partial_json;
            bytesIn += event.delta.partial_json.length;
            // Cada ~200 chars notificamos progreso.
            if (bytesIn % 200 < 50) {
              send({ type: "progress", chars: bytesIn });
            }
          }
        }

        const finalMsg = await messageStream.finalMessage();

        // Si se cortó por límite de tokens, el JSON queda incompleto: avisamos
        // claro en vez del genérico "JSON inválido".
        if (finalMsg.stop_reason === "max_tokens") {
          console.error("[diagnostico/generate] truncated by max_tokens", {
            chars: toolInputRaw.length,
          });
          send({
            type: "error",
            error:
              "El informe quedó demasiado largo y se cortó. Probá de nuevo; si vuelve a pasar, acortá la transcripción.",
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

        // Normaliza: a veces el modelo serializa subcampos como strings.
        toolInput = normalizeDiagnostic(toolInput);

        if (!isDiagnosticShape(toolInput)) {
          console.error("[diagnostico/generate] invalid shape", toolInput);
          send({ type: "error", error: "Estructura del diagnóstico inválida." });
          controller.close();
          return;
        }
        const content = toolInput as DiagnosticContent;

        send({ type: "saving" });

        const { data: versionRow, error: versionErr } = await admin.rpc(
          "next_diagnostic_version",
          { p_cliente: body.cliente_id! }
        );
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
            transcript_text: transcript,
            source_pdf_path: body.source_pdf_path ?? null,
            generated_with_model: DIAGNOSTIC_GENERATOR_MODEL,
            generated_at: new Date().toISOString(),
            created_by: user.id,
          })
          .select("id, version")
          .single();

        if (insertErr || !inserted) {
          console.error("[diagnostico/generate] insert error", insertErr);
          send({ type: "error", error: "No se pudo guardar el draft." });
          controller.close();
          return;
        }

        send({
          type: "done",
          id: inserted.id,
          version: inserted.version,
          content,
        });
      } catch (err) {
        console.error("[diagnostico/generate] stream error", err);
        const msg = err instanceof Error ? err.message : "Error en la generación.";
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
        } catch {
          /* ya cerrado */
        }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
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
