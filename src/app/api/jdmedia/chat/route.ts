import { NextResponse } from "next/server";
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

# Cómo actuar
- Hablás en español rioplatense (vos), directo y conciso.
- Antes de crear o modificar algo, confirmá. Mostrá lo que vas a hacer.
- Si te piden info que está en procesos/SOPs, usá search_processes y citá la página.
- Las fechas las cargás en zona Argentina (UTC-3).
- No inventes datos. Si una tool falla, decilo.

# Tono
Profesional pero cercano. Sin emoji a menos que el usuario los use. Sin disclaimers innecesarios.`;
}

const MAX_HISTORY_MSGS = 40; // Limitamos el contexto para no explotar tokens.
const MAX_USER_TEXT = 12_000;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const me = await requireUser();
  const supabase = createClient();

  const body = (await req.json()) as {
    conversationId?: string | null;
    text: string;
  };

  const text = (body.text ?? "").toString().slice(0, MAX_USER_TEXT).trim();
  if (!text) {
    return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
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
      return NextResponse.json(
        { error: "Conversación no encontrada." },
        { status: 404 }
      );
    }
  } else {
    const initialTitle = text.slice(0, 60);
    const { data: created, error: convErr } = await supabase
      .from("ai_conversations")
      .insert({ user_id: me.id, title: initialTitle })
      .select("id")
      .single();
    if (convErr || !created) {
      return NextResponse.json(
        { error: "No se pudo crear la conversación: " + (convErr?.message ?? "") },
        { status: 500 }
      );
    }
    conversationId = created.id;
  }

  // 2) Guardar mensaje del usuario
  const { error: insErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: text });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // 3) Cargar historial de la conversación
  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MSGS);

  const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: [{ type: "text", text: m.content as string }],
  }));

  const system = systemPrompt(me.nombre, me.area, me.rol);

  // 4) Tool-use loop (igual que el chat flotante)
  let iter = 0;
  let finalText = "";
  while (iter < 6) {
    iter++;
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: TOOLS,
        messages,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg, conversationId }, { status: 500 });
    }

    messages.push({ role: "assistant", content: response.content });

    const turnText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (turnText) finalText = turnText;

    if (response.stop_reason !== "tool_use") break;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const res = await runTool(tu.name, tu.input as Record<string, unknown>, me.id);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(res).slice(0, 8000),
        is_error: !res.ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // 5) Guardar respuesta del assistant
  if (finalText) {
    await supabase
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: finalText });
    // Bump updated_at de la conversación para que ordene por reciente
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return NextResponse.json({
    reply: finalText,
    conversationId,
  });
}
