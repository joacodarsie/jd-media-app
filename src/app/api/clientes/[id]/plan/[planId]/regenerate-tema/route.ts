import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { MonthlyContentPlan, TemaDestacado } from "@/lib/content-plans/schema";
import { AI_MODEL_SMART } from "@/lib/ai/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();
const MODEL = AI_MODEL_SMART;

const SYSTEM_PROMPT = `Sos el director de contenido de JD Media. Tu tarea: REEMPLAZAR un tema específico del plan de contenido del cliente con una idea distinta, manteniendo coherencia con el resto del plan.

# Reglas
1. La nueva idea NO debe repetir el tema viejo ni los temas ya existentes en el plan.
2. Tiene que respetar el pilar y el formato del tema viejo (a menos que el usuario sugiera lo contrario en su hint).
3. Tiene que ser CONCRETA, no vaga. Mostrá una pieza específica con ángulo claro.
4. Aplicá el tono y la voz del cliente (definido en el diagnóstico si está disponible).
5. Si vino un hint del usuario, respetalo: es el motivo del cambio.

# Output
Llamás a la tool \`save_tema\` con la nueva versión del tema (mismos campos que TemaDestacado: titulo, descripcion, fecha?, pilar?, formato?, red_principal?, redes_replica?).`;

const SAVE_TEMA_TOOL = {
  name: "save_tema",
  description: "Guarda la nueva versión del tema reemplazado.",
  input_schema: {
    type: "object" as const,
    properties: {
      titulo: { type: "string" },
      descripcion: { type: "string" },
      fecha: { type: "string" },
      pilar: { type: "string" },
      formato: {
        type: "string",
        enum: ["reel", "post", "carrusel", "story", "video_largo", "live", "otro"],
      },
      red_principal: {
        type: "string",
        enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
      },
      redes_replica: {
        type: "array",
        items: {
          type: "string",
          enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
        },
      },
    },
    required: ["titulo", "descripcion", "formato", "red_principal", "pilar"],
  },
};

export async function POST(
  req: Request,
  { params }: { params: { id: string; planId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { temaIndex?: number; hint?: string } | null;
  if (!body || typeof body.temaIndex !== "number") {
    return NextResponse.json({ error: "Falta temaIndex." }, { status: 400 });
  }
  const temaIndex = body.temaIndex;
  const hint = (body.hint ?? "").trim();

  const admin = createAdmin();

  const { data: plan } = await admin
    .from("client_content_plans")
    .select("id, cliente_id, content, periodo_label, applied_temas_indices")
    .eq("id", params.planId)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });

  const content = plan.content as unknown as MonthlyContentPlan;
  const temas: TemaDestacado[] = Array.isArray(content?.temas_destacados)
    ? content.temas_destacados
    : [];
  const temaViejo = temas[temaIndex];
  if (!temaViejo) return NextResponse.json({ error: "Tema no encontrado." }, { status: 404 });

  const applied: number[] = Array.isArray(plan.applied_temas_indices) ? plan.applied_temas_indices : [];
  if (applied.includes(temaIndex)) {
    return NextResponse.json(
      { error: "Este tema ya fue aplicado al calendario. Editá la publicación directamente." },
      { status: 400 }
    );
  }

  // Cargar diagnostico para contexto
  const { data: diagRow } = await admin
    .from("client_diagnostics")
    .select("content")
    .eq("cliente_id", plan.cliente_id)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let diagSubset: Record<string, unknown> | null = null;
  if (diagRow?.content && typeof diagRow.content === "object") {
    const c = diagRow.content as Record<string, unknown>;
    diagSubset = {
      publico_objetivo: c.publico_objetivo,
      marca: c.marca,
      diferenciales: c.diferenciales,
      pilares_contenido: c.pilares_contenido,
    };
  }

  const userMsgLines: string[] = [];
  userMsgLines.push(`# Plan vigente: "${plan.periodo_label}"`);
  userMsgLines.push("");
  userMsgLines.push("## Tema a REEMPLAZAR");
  userMsgLines.push(JSON.stringify(temaViejo, null, 2));
  userMsgLines.push("");
  if (hint) {
    userMsgLines.push("## Motivo del cambio / pedido del usuario");
    userMsgLines.push(hint);
    userMsgLines.push("");
  }
  userMsgLines.push("## Otros temas del plan (NO repetir ninguno)");
  userMsgLines.push(
    JSON.stringify(
      temas.filter((_, i) => i !== temaIndex).map((t) => ({ titulo: t.titulo, pilar: t.pilar, formato: t.formato })),
      null,
      2
    )
  );
  userMsgLines.push("");
  if (diagSubset) {
    userMsgLines.push("## Brief del cliente (diagnóstico)");
    userMsgLines.push(JSON.stringify(diagSubset, null, 2));
    userMsgLines.push("");
  }
  userMsgLines.push("# Tu tarea");
  userMsgLines.push("Generá UN nuevo tema que reemplace al de arriba. Llamá a `save_tema`.");

  let nuevoTema: TemaDestacado | null = null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [SAVE_TEMA_TOOL],
      tool_choice: { type: "tool", name: "save_tema" },
      messages: [{ role: "user", content: userMsgLines.join("\n") }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "El modelo no devolvió un tema válido." },
        { status: 502 }
      );
    }
    nuevoTema = toolUse.input as TemaDestacado;
  } catch (err) {
    console.error("[regenerate-tema] anthropic", err);
    return NextResponse.json({ error: "Error generando" }, { status: 502 });
  }

  // Actualizar el tema en el content jsonb del plan
  const newTemas = [...temas];
  newTemas[temaIndex] = nuevoTema;
  const newContent = { ...content, temas_destacados: newTemas };

  const { error: updateErr } = await admin
    .from("client_content_plans")
    .update({ content: newContent as unknown as Record<string, unknown> })
    .eq("id", plan.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ tema: nuevoTema });
}
