import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  CONTENT_PLAN_MODEL,
  CONTENT_PLAN_SYSTEM_PROMPT,
  SAVE_CONTENT_PLAN_TOOL,
  buildPlanUserMessage,
} from "@/lib/content-plans/generate-prompt";
import { isPlanShape, type MonthlyContentPlan } from "@/lib/content-plans/schema";
import { normalizeDiagnostic } from "@/lib/diagnostics/schema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

/**
 * POST /api/clientes/[id]/plan/generate
 *
 * SSE — devuelve eventos hasta el plan generado.
 * Body JSON: { periodo_label: string }
 *
 * Eventos: starting, progress(chars), saving, done(id, content), error(error)
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const cliente_id = params.id;
  const body = (await req.json().catch(() => null)) as { periodo_label?: string } | null;
  const periodo_label = (body?.periodo_label ?? "").trim();
  if (!periodo_label) {
    return new Response("Falta periodo_label (ej: 'Mayo 2026').", { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", cliente_id)
    .maybeSingle();
  if (!client) return new Response("Cliente no encontrado.", { status: 403 });

  const admin = createAdmin();

  // Cargar contexto en paralelo: diagnostico aprobado, últimas publicadas (60d), planificadas.
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: diagRow },
    { data: publishedPubs },
    { data: pipelinePubs },
  ] = await Promise.all([
    admin
      .from("client_diagnostics")
      .select("content")
      .eq("cliente_id", cliente_id)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("publications")
      .select("titulo, tipo, red, fecha_publicacion")
      .eq("cliente_id", cliente_id)
      .eq("estado", "publicado")
      .gte("fecha_publicacion", sixtyDaysAgo)
      .order("fecha_publicacion", { ascending: false })
      .limit(40),
    admin
      .from("publications")
      .select("titulo, tipo, red, fecha_publicacion, estado")
      .eq("cliente_id", cliente_id)
      .not("estado", "eq", "publicado")
      .order("fecha_publicacion", { ascending: true, nullsFirst: false })
      .limit(40),
  ]);

  // Subset del diagnóstico que necesita el modelo (pilares, público, marca, diferenciales, etc.)
  let diagnosticoForPrompt: Record<string, unknown> | null = null;
  if (diagRow && diagRow.content && typeof diagRow.content === "object") {
    const c = diagRow.content as Record<string, unknown>;
    diagnosticoForPrompt = {
      contexto: c.contexto,
      publico_objetivo: c.publico_objetivo,
      marca: c.marca,
      diferenciales: c.diferenciales,
      pilares_contenido: c.pilares_contenido,
      objetivos_trimestre: c.objetivos_trimestre,
      recursos_limitaciones: c.recursos_limitaciones,
    };
  }

  const userMessage = buildPlanUserMessage({
    clienteNombre: client.nombre,
    periodoLabel: periodo_label,
    diagnostico: diagnosticoForPrompt,
    publicacionesUltimos60d: (publishedPubs ?? []).map(
      (p: { titulo: string; tipo: string; red: string; fecha_publicacion: string | null }) => ({
        titulo: p.titulo,
        tipo: p.tipo,
        red: p.red,
        fecha: p.fecha_publicacion,
      })
    ),
    publicacionesPlanificadas: (pipelinePubs ?? []).map(
      (p: {
        titulo: string;
        tipo: string;
        red: string;
        fecha_publicacion: string | null;
        estado: string;
      }) => ({
        titulo: p.titulo,
        tipo: p.tipo,
        red: p.red,
        fecha: p.fecha_publicacion,
        estado: p.estado,
      })
    ),
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
          /* */
        }
      }, 10_000);

      try {
        send({ type: "starting" });

        let toolInputRaw = "";
        let bytesIn = 0;

        const messageStream = anthropic.messages.stream({
          model: CONTENT_PLAN_MODEL,
          max_tokens: 6144,
          system: [
            {
              type: "text",
              text: CONTENT_PLAN_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [SAVE_CONTENT_PLAN_TOOL],
          tool_choice: { type: "tool", name: "save_content_plan" },
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
        await messageStream.finalMessage();

        let toolInput: unknown;
        try {
          toolInput = JSON.parse(toolInputRaw);
        } catch {
          send({ type: "error", error: "El modelo devolvió JSON inválido." });
          controller.close();
          return;
        }

        // Reusa el sanitizer del diagnostico: misma logica de "string que deberia ser objeto/array"
        toolInput = normalizeDiagnostic(toolInput);

        if (!isPlanShape(toolInput)) {
          console.error("[plan/generate] invalid shape", toolInput);
          send({ type: "error", error: "Estructura del plan inválida." });
          controller.close();
          return;
        }
        const content = toolInput as MonthlyContentPlan;

        send({ type: "saving" });

        const { data: inserted, error: insertErr } = await admin
          .from("client_content_plans")
          .insert({
            cliente_id,
            periodo_label,
            status: "draft",
            content: content as unknown as Record<string, unknown>,
            generated_with_model: CONTENT_PLAN_MODEL,
            generated_at: new Date().toISOString(),
            created_by: user.id,
          })
          .select("id")
          .single();

        if (insertErr || !inserted) {
          console.error("[plan/generate] insert error", insertErr);
          send({ type: "error", error: "No se pudo guardar el plan." });
          controller.close();
          return;
        }

        send({ type: "done", id: inserted.id, content });
      } catch (err) {
        console.error("[plan/generate] stream error", err);
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
