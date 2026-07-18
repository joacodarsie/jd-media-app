import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { TOOLS, runTool } from "@/lib/ai/tools";
import { fetchAllUrls } from "@/lib/url-fetch";
import { friendlyAiError } from "@/lib/ai/errors";
import { AI_MODEL_FAST } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Consultas con varias tools superaban los 60s del gateway y el popup moría
// con error genérico → mismo transporte SSE que jdmedia/chat y post-meet.
export const maxDuration = 300;

const client = new Anthropic();

const MODEL = AI_MODEL_FAST;

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
- Si el usuario te pide info que está en procesos/SOPs del negocio, usá search_processes y citá la página.
- Si te preguntan **cómo se usa la app** ("cómo creo X", "dónde está Y", "qué es Z dentro de la app", "cómo apruebo publicaciones"), usá **search_help** y, si necesitás el contenido completo, **get_help_page**. Respondé con instrucciones concretas + linkeá la guía completa (URL formato \`/ayuda/<slug>\`).
- Si te preguntan por una persona, cliente o tarea por nombre parcial, usá las tools con search/ilike.
- Las fechas las cargás siempre en zona horaria Argentina (UTC-3). Si dicen "el viernes" calculá la fecha desde hoy.
- Cuando devolvés listas largas, resumí y ofrecé filtrar.
- No inventes IDs, nombres ni datos. Si una tool falla o no encuentra algo, decilo.

# Centro de ayuda interno
Toda la documentación de "cómo se usa la app" vive en \`/ayuda\` y la podés consultar con \`search_help\` + \`get_help_page\`. Hay guías por feature y por rol. Cuando pregunten algo operativo de la app, NO inventes — buscá en la ayuda real.

# Adjuntos del usuario
El usuario puede mandarte **imágenes, PDFs, CSV y URLs**. Cuando vengan:
- **Imagen**: describila o usá lo que ves para responder (referencia de diseño, captura de pantalla, mockup, ticket, etc.).
- **PDF**: leelo entero y respondé respecto al contenido. Citá la sección si corresponde.
- **CSV**: aparece como bloque de código. Analizá filas/columnas; si te piden, sumarizalo o extraé insights.
- **Contexto auto-extraído de URLs**: el sistema ya fetcheó las URLs que el usuario pegó y te las pasó como texto. Tratalo como info confiable.

# Atajos
- "Qué tengo hoy", "resumime el día", "por dónde arranco" → usá **summarize_my_day** y devolvé 1-2 frases con la prioridad clara (qué hacer primero y por qué).
- "Quién está colapsado", "carga del equipo", "a quién le puedo pasar X" → usá **suggest_reassignments** y, si hay sobrecargados, sugerí pasarlo a alguien de **disponibles** de la misma área.
- "Escribime el copy de…", "redactá un post para…", "necesito un guion de reel" → primero usá **client_brand_context** del cliente, después escribí el copy respetando el tono del cliente. Devolvé copy + hashtags + sugerencia de hora de publicación.

# Tono
Profesional pero cercano. Sin emoji a menos que el usuario los use. Sin disclaimers innecesarios.

# Permisos de este usuario (IMPORTANTE)
${
  userRol === "admin" || userRol === "coordinador"
    ? `Rol ${userRol} — acceso completo a todas las secciones. Podés responder cualquier cosa.`
    : `Rol ${userRol} — acceso LIMITADO. Hay secciones a las que NO tiene acceso:
- **Finanzas, pagos, montos, contratos del equipo** → NO podés responder. Decí: *"Esa info es de finanzas, no la puedo compartir desde tu cuenta. Pedile a un admin o coordinador."*
- **Datos sensibles del cliente** (CBU, alias, contacto privado, monto del pack) → NO mostrar.
- **Accesos / contraseñas / gestión de usuarios** → NO ayudar.
Para todo lo demás (tareas, ideas, calendarios, posts, planes, etc.) respondé normal.`
}`;
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

  // URL enrichment: solo en el último mensaje del usuario (evita refetchear historial).
  const last = messages[messages.length - 1];
  if (last && last.role === "user" && Array.isArray(last.content)) {
    const userText = last.content
      .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (userText) {
      const fetched = await fetchAllUrls(userText);
      const okOnes = fetched.filter((f) => f.ok && f.text);
      if (okOnes.length > 0) {
        const ctx = okOnes
          .map(
            (f) =>
              `--- contenido de ${f.url}${f.title ? ` (${f.title})` : ""} ---\n${f.text}`
          )
          .join("\n\n");
        last.content = [
          ...last.content,
          {
            type: "text",
            text: `\n\n[Contexto auto-extraído de URLs mencionadas]\n${ctx}`,
          },
        ];
      }
    }
  }

  // System prompt cacheable (prompt caching): estable durante la conversación,
  // se reusa desde cache en cada iteración del loop de tools y request siguiente.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemPrompt(me.nombre, me.area, me.rol),
      cache_control: { type: "ephemeral" },
    },
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
        // Tool-use loop. Max 6 iterations to avoid runaway.
        let iter = 0;
        let finalText = "";
        while (iter < 6) {
          iter++;
          const response: Anthropic.Message = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system,
            tools: TOOLS,
            messages,
            // Haiku 4.5 (AI_MODEL_FAST) no soporta thinking adaptivo ni
            // extendido: mandarlo devuelve 400.
          });

          // Append assistant turn verbatim
          messages.push({ role: "assistant", content: response.content });

          // Collect any text blocks emitted this turn
          const turnText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          if (turnText) finalText = turnText;

          if (response.stop_reason !== "tool_use") break;

          send({ type: "status", text: "Consultando datos…" });

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

        send({ type: "done", reply: finalText });
      } catch (e) {
        console.error("[chat] anthropic error", e);
        try {
          send({ type: "error", error: friendlyAiError(e) });
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
