import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  MONTHLY_DIAGNOSTIC_MODEL,
  MONTHLY_DIAGNOSTIC_SYSTEM_PROMPT,
  SAVE_MONTHLY_DIAGNOSTIC_TOOL,
  buildMonthlyDiagnosticUserMessage,
} from "@/lib/monthly-diagnostics/prompt";
import { loadMeetingContext, toDiagnosticContext } from "@/lib/monthly-diagnostics/context";
import { generateClientReport } from "@/lib/monthly-diagnostics/client-report";
import { normalizeMonthlyDiagnostic } from "@/lib/monthly-diagnostics/schema";
import { trackAiUsage } from "@/lib/ai/usage";
import { hoyYmd } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

/**
 * POST /api/reunion-mensual/generate
 *
 * Genera el diagnóstico MENSUAL a partir de la transcripción de la reunión de
 * fin de mes. SSE por el mismo motivo que /api/diagnostico/generate: el gateway
 * corta las respuestas no-streaming a los 60s.
 *
 * Eventos: starting · progress · saving · informe · done · error
 *
 * Genera dos documentos de una: el diagnóstico INTERNO y el informe AMIGABLE
 * que se le manda al cliente.
 *
 * Body JSON: { cliente_id, periodo, transcript_text, source_pdf_path?, notas? }
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    cliente_id?: string;
    periodo?: string;
    transcript_text?: string;
    source_pdf_path?: string | null;
    notas?: string | null;
  } | null;

  if (!body?.cliente_id || !body.periodo || !body.transcript_text) {
    return new Response("Faltan cliente_id, periodo o transcript_text.", { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(body.periodo)) {
    return new Response("Período inválido.", { status: 400 });
  }
  if (body.transcript_text.trim().length < 200) {
    return new Response(
      "La transcripción es muy corta (menos de 200 caracteres).",
      { status: 400 }
    );
  }

  const clienteId = body.cliente_id;
  const periodo = body.periodo;
  const transcript = body.transcript_text.slice(0, 150_000);
  const notas = typeof body.notas === "string" ? body.notas.slice(0, 4000) : null;

  // El acceso al cliente lo filtra RLS: si no lo puede leer, no puede generar.
  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", clienteId)
    .maybeSingle();
  if (!client) return new Response("Cliente no encontrado.", { status: 403 });

  const admin = createAdmin();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* stream cerrado */
        }
      };

      // Heartbeat para que el proxy no cierre por inactividad.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream cerrado */
        }
      }, 10_000);

      try {
        send({ type: "starting" });

        const ctx = await loadMeetingContext(clienteId, periodo);
        const userMessage = buildMonthlyDiagnosticUserMessage(
          toDiagnosticContext(ctx, transcript, notas)
        );

        let toolInputRaw = "";
        let bytesIn = 0;

        const messageStream = anthropic.messages.stream({
          model: MONTHLY_DIAGNOSTIC_MODEL,
          max_tokens: 8192,
          system: [
            {
              type: "text",
              text: MONTHLY_DIAGNOSTIC_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [SAVE_MONTHLY_DIAGNOSTIC_TOOL],
          tool_choice: { type: "tool", name: "save_monthly_diagnostic" },
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "input_json_delta"
          ) {
            toolInputRaw += event.delta.partial_json;
            bytesIn += event.delta.partial_json.length;
            if (bytesIn % 200 < 50) send({ type: "progress", chars: bytesIn });
          }
        }

        const finalMsg = await messageStream.finalMessage();
        void trackAiUsage({
          ruta: "reunion-mensual/diagnostico",
          modelo: MONTHLY_DIAGNOSTIC_MODEL,
          usage: finalMsg.usage,
        });

        if (finalMsg.stop_reason === "max_tokens") {
          console.error("[reunion-mensual/generate] truncated by max_tokens", {
            chars: toolInputRaw.length,
          });
          send({
            type: "error",
            error:
              "El diagnóstico se cortó por largo. Probá de nuevo; si vuelve a pasar, recortá la transcripción.",
          });
          controller.close();
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(toolInputRaw);
        } catch {
          send({ type: "error", error: "El modelo devolvió JSON inválido." });
          controller.close();
          return;
        }

        const content = normalizeMonthlyDiagnostic(parsed);
        if (content.resumen.length === 0 && content.acciones_proximo_mes.length === 0) {
          send({
            type: "error",
            error:
              "El diagnóstico salió vacío. Revisá que la transcripción tenga la conversación completa.",
          });
          controller.close();
          return;
        }

        send({ type: "saving" });

        // El informe que se le manda al cliente sale del mismo análisis. Lo
        // generamos acá mismo para que el equipo no tenga que acordarse de
        // apretar otro botón. Si falla, el diagnóstico interno igual se guarda
        // y queda el botón "Rehacer informe" en la sección.
        send({ type: "informe" });
        const clientReport = await generateClientReport(ctx, content);

        // Uno por cliente y mes: regenerar pisa. Reseteamos el marcador de
        // tareas porque las acciones nuevas son otras.
        const { error: upsertErr } = await admin
          .from("client_monthly_diagnostics")
          .upsert(
            {
              cliente_id: clienteId,
              periodo,
              content: content as unknown as Record<string, unknown>,
              client_report: clientReport as unknown as Record<string, unknown> | null,
              client_report_at: clientReport ? new Date().toISOString() : null,
              transcript_text: transcript,
              source_pdf_path: body.source_pdf_path ?? null,
              generated_with_model: MONTHLY_DIAGNOSTIC_MODEL,
              generated_at: new Date().toISOString(),
              tasks_created_at: null,
              tasks_created_count: null,
              created_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "cliente_id,periodo" }
          );

        if (upsertErr) {
          console.error("[reunion-mensual/generate] upsert error", upsertErr);
          send({
            type: "error",
            error:
              upsertErr.message.includes("client_monthly_diagnostics")
                ? "Falta aplicar la migración del diagnóstico mensual en Supabase."
                : "No se pudo guardar el diagnóstico.",
          });
          controller.close();
          return;
        }

        // Si hubo reunión, la reunión del mes está hecha: la registramos sola
        // para que la ficha del cliente y el panel de calidad queden al día.
        const { error: meetingErr } = await admin.from("client_meetings").upsert(
          {
            cliente_id: clienteId,
            periodo,
            fecha: hoyYmd(),
            notas: content.resumen.join(" · ") || null,
            registrado_por: user.id,
          },
          { onConflict: "cliente_id,periodo" }
        );
        if (meetingErr) {
          // No bloquea: el diagnóstico ya quedó guardado.
          console.error("[reunion-mensual/generate] meeting upsert error", meetingErr);
        }

        send({ type: "done", periodo, content });
      } catch (err) {
        console.error("[reunion-mensual/generate] stream error", err);
        const msg = err instanceof Error ? err.message : "Error en la generación.";
        send({ type: "error", error: msg });
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
