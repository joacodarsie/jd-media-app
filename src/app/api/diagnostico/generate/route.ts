import { NextResponse } from "next/server";
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
import { isDiagnosticShape, type DiagnosticContent } from "@/lib/diagnostics/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const anthropic = new Anthropic();

/**
 * POST /api/diagnostico/generate
 *
 * Body JSON:
 *   - cliente_id:      UUID
 *   - transcript_text: string (extraída por /upload-transcript)
 *   - source_pdf_path: string | null
 *
 * Crea una versión nueva (draft) del diagnóstico para ese cliente.
 * Devuelve { id, version, content }.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    cliente_id?: string;
    transcript_text?: string;
    source_pdf_path?: string | null;
  } | null;

  if (!body?.cliente_id || !body.transcript_text) {
    return NextResponse.json(
      { error: "Faltan cliente_id o transcript_text." },
      { status: 400 }
    );
  }
  if (body.transcript_text.length < 200) {
    return NextResponse.json({ error: "Transcripción muy corta." }, { status: 400 });
  }
  // Cap defensivo: ~150k chars ≈ 50k tokens, dentro de límite.
  const transcript =
    body.transcript_text.length > 150_000
      ? body.transcript_text.slice(0, 150_000)
      : body.transcript_text;

  // Verificar acceso al cliente y traer datos base.
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, nombre, rubro, pack, redes_sociales")
    .eq("id", body.cliente_id)
    .maybeSingle();
  if (clientErr || !client) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 403 });
  }

  const admin = createAdmin();

  // Servicios contratados (opcional, mejora el contexto).
  const { data: contratados } = await admin
    .from("client_services")
    .select("tipo")
    .eq("cliente_id", body.cliente_id)
    .eq("activo", true);
  const serviciosContratados = (contratados ?? [])
    .map((row: { tipo: string | null }) => row.tipo)
    .filter((x): x is string => Boolean(x));

  // Redes (jsonb array: [{ red, handle, url }, ...])
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

  const userMessage = buildGenerateUserMessage({
    clienteNombre: client.nombre,
    rubro: (client as { rubro?: string | null }).rubro,
    pack: (client as { pack?: string | null }).pack,
    serviciosContratados,
    redes,
    transcript,
  });

  // Llamada a Claude con tool forzada — garantiza JSON estructurado.
  // Prompt caching: system + few-shot quedan cacheados (5 min TTL).
  let toolInput: unknown;
  try {
    const response = await anthropic.messages.create({
      model: DIAGNOSTIC_GENERATOR_MODEL,
      max_tokens: 8192,
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

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "El modelo no devolvió el diagnóstico estructurado." },
        { status: 502 }
      );
    }
    toolInput = toolUse.input;
  } catch (err) {
    console.error("[diagnostico/generate] anthropic error", err);
    return NextResponse.json(
      { error: "Error generando el diagnóstico con la IA." },
      { status: 502 }
    );
  }

  if (!isDiagnosticShape(toolInput)) {
    console.error("[diagnostico/generate] invalid shape", toolInput);
    return NextResponse.json(
      { error: "El diagnóstico generado no tiene la estructura esperada." },
      { status: 502 }
    );
  }
  const content = toolInput as DiagnosticContent;

  // Próxima versión
  const { data: versionRow, error: versionErr } = await admin.rpc(
    "next_diagnostic_version",
    { p_cliente: body.cliente_id }
  );
  if (versionErr || typeof versionRow !== "number") {
    return NextResponse.json(
      { error: "No se pudo calcular versión." },
      { status: 500 }
    );
  }

  // Insertar el draft
  const { data: inserted, error: insertErr } = await admin
    .from("client_diagnostics")
    .insert({
      cliente_id: body.cliente_id,
      version: versionRow,
      status: "draft",
      content,
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
    return NextResponse.json({ error: "No se pudo guardar el draft." }, { status: 500 });
  }

  return NextResponse.json({
    id: inserted.id,
    version: inserted.version,
    content,
  });
}
