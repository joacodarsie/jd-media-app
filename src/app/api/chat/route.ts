import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { TOOLS, runTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();

const MODEL = "claude-sonnet-4-6";

function systemPrompt(userName: string, userArea: string, userRol: string) {
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Argentina/Cordoba",
  });
  return `Sos el asistente interno de **JD Media**, una agencia de marketing digital cordobesa especializada en gestión de redes, paid media, diseño y desarrollo web para PyMEs y emprendedores.

# Quién te habla
- Nombre: ${userName}
- Área: ${userArea}
- Rol: ${userRol}
- Fecha actual: ${today}

# Tu trabajo
Ayudás al equipo a operar JD Media: crear/editar tareas, consultar clientes, planificar publicaciones, encontrar procesos internos, responder dudas del negocio. Hablás en español rioplatense (vos), directo y conciso.

# Estructura de la app
- **Tareas**: lo que cada persona tiene que hacer. Tienen estado, prioridad, fecha límite, asignado, cliente, área.
- **Clientes**: cuentas activas con packs (Presencia / Crecimiento / Personalizado). Cada cliente tiene drive, calendario de contenidos, redes, contacto y responsable.
- **Calendario de contenidos** (publicaciones): cada cliente tiene posts/reels/historias planificados con flujo de aprobación (idea → diseño → revisión creativa → revisión cliente → aprobado → publicado).
- **Equipo**: puestos con alcance, herramientas, KPIs y procesos. Cada persona tiene un puesto y una compensación.
- **Agencia + Procesos**: fundamentos, buyer persona "Camila", SOPs (onboarding cliente, cadena de mensajes, cierre, primer meet).

# Cómo actuar
- **Antes de crear o modificar algo, confirmá con el usuario.** Mostrá lo que vas a hacer y esperá ok salvo que la instrucción sea inequívoca.
- Si el usuario te pide info que está en procesos/SOPs, usá search_processes y citá la página.
- Si te preguntan por una persona, cliente o tarea por nombre parcial, usá las tools con search/ilike.
- Las fechas las cargás siempre en zona horaria Argentina (UTC-3). Si dicen "el viernes" calculá la fecha desde hoy.
- Cuando devolvés listas largas, resumí y ofrecé filtrar.
- No inventes IDs, nombres ni datos. Si una tool falla o no encuentra algo, decilo.

# Tono
Profesional pero cercano. Sin emoji a menos que el usuario los use. Sin disclaimers innecesarios.`;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string | Anthropic.ContentBlockParam[];
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const me = await requireUser();
  const body = (await req.json()) as { messages: IncomingMessage[] };
  const incoming = (body.messages ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant"));

  // Normalize content to ContentBlockParam[] for the API
  const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? [{ type: "text", text: m.content }]
        : m.content,
  }));

  const system = systemPrompt(me.nombre, me.area, me.rol);

  // Tool-use loop. Max 6 iterations to avoid runaway.
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
        thinking: { type: "adaptive" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Append assistant turn verbatim
    messages.push({ role: "assistant", content: response.content });

    // Collect any text blocks emitted this turn
    const turnText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (turnText) finalText = turnText;

    if (response.stop_reason !== "tool_use") break;

    // Execute every tool_use block; aggregate results into one user message
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

  return NextResponse.json({ reply: finalText });
}
