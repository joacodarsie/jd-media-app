import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AI_MODEL_SMART } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Varias transcripciones largas → SSE + 300s (regla de la casa para rutas IA).
export const maxDuration = 300;

const client = new Anthropic();

/**
 * POST /api/reclutamiento/compare  { searchId }
 *
 * Compara con IA a los candidatos de una búsqueda (los que tengan CV y/o
 * transcripción de entrevista): ranking con ventajas/desventajas de cada uno y
 * recomendación. Streamea SSE y guarda el resultado en la búsqueda.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { searchId?: string } | null;
  if (!body?.searchId) {
    return NextResponse.json({ error: "Falta searchId." }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: search } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, perfil")
    .eq("id", body.searchId)
    .maybeSingle();
  if (!search) return NextResponse.json({ error: "Búsqueda no encontrada." }, { status: 404 });
  const s = search as { id: string; titulo: string; area: string | null; perfil: string | null };

  const { data: candRaw } = await admin
    .from("recruitment_candidates")
    .select(
      "id, nombre, fase, resumen, fortalezas, dudas, fit_score, anios_experiencia, skills, entrevista_transcript, entrevista_notas, entrevista_analisis"
    )
    .eq("search_id", s.id)
    .neq("fase", "descartado");
  const candidates = (candRaw ?? []) as Array<{
    id: string;
    nombre: string | null;
    fase: string;
    resumen: string | null;
    fortalezas: string[] | null;
    dudas: string[] | null;
    fit_score: number | null;
    anios_experiencia: number | null;
    skills: string[] | null;
    entrevista_transcript: string | null;
    entrevista_notas: string | null;
    entrevista_analisis: string | null;
  }>;

  if (candidates.length < 2) {
    return NextResponse.json(
      { error: "Hacen falta al menos 2 candidatos (no descartados) para comparar." },
      { status: 400 }
    );
  }

  // Presupuesto de contexto: transcripciones capadas para que entren todas.
  const perCand = Math.floor(120_000 / candidates.length);
  const fichas = candidates
    .map((c, i) => {
      const parts = [
        `## Candidato ${i + 1}: ${c.nombre ?? "(sin nombre)"} — fase actual: ${c.fase}`,
      ];
      if (c.resumen) parts.push(`CV: ${c.resumen}`);
      if (c.anios_experiencia != null) parts.push(`Experiencia: ${c.anios_experiencia} años`);
      if (c.skills?.length) parts.push(`Skills: ${c.skills.join(", ")}`);
      if (c.fit_score != null) parts.push(`Fit score CV: ${c.fit_score}/100`);
      if (c.entrevista_analisis) parts.push(`Análisis de entrevista previo:\n${c.entrevista_analisis}`);
      if (c.entrevista_notas) parts.push(`Notas de la entrevista:\n${c.entrevista_notas}`);
      if (c.entrevista_transcript)
        parts.push(`Transcripción de la entrevista:\n${c.entrevista_transcript.slice(0, perCand)}`);
      return parts.join("\n");
    })
    .join("\n\n");

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
        const messageStream = client.messages.stream({
          model: AI_MODEL_SMART,
          max_tokens: 16384,
          thinking: { type: "adaptive" },
          system:
            "Sos el analista de selección de JD Media (agencia de marketing digital de Córdoba, trabajo remoto freelance, se paga por producción). Comparás candidatos con criterio práctico de agencia: capacidad real de ejecutar, confiabilidad con los plazos, trato con clientes, y relación calidad/costo. Español rioplatense, directo, sin diplomacia vacía.",
          messages: [
            {
              role: "user",
              content: `Compará a los candidatos para el puesto "${s.titulo}"${s.perfil ? ` (perfil buscado: ${s.perfil})` : ""}.\n\n${fichas}\n\nDevolvé:\n# 🏆 Ranking\nTabla: puesto | candidato | veredicto en 1 línea.\n\n# Por candidato\nPara cada uno: **Ventajas** (bullets) · **Desventajas/dudas** (bullets) · **Qué validar antes de avanzar**.\n\n# 🎯 Recomendación final\nA quién avanzar a la siguiente fase (pueden ser varios), a quién descartar y por qué. Si falta info clave de alguno (ej: sin entrevista cargada), decilo.`,
            },
          ],
        });

        let full = "";
        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }
        const finalMsg = await messageStream.finalMessage();
        if (finalMsg.stop_reason === "max_tokens") {
          send({ type: "error", error: "El análisis quedó muy largo y se cortó. Probá descartando candidatos que ya no correr." });
          return;
        }
        const texto = full.trim();
        await admin
          .from("recruitment_searches")
          .update({ analisis_comparativo: texto, analisis_at: new Date().toISOString() })
          .eq("id", s.id);
        send({ type: "done", analisis: texto });
      } catch (e) {
        console.error("[reclutamiento/compare] error", e);
        const msg = e instanceof Error ? e.message : "Error inesperado";
        try {
          send({ type: "error", error: msg });
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
