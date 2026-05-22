"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const MODEL = "claude-sonnet-4-6";

export interface AISuggestion {
  titulo: string;
  copy: string;
  hashtags: string;
  descripcion: string;
  guion: string | null;
  notas: string;
}

interface ClientDocSummary {
  titulo: string;
  categoria: string;
  descripcion: string | null;
}

interface ClientContext {
  nombre: string;
  rubro: string | null;
  pack: string | null;
  notas: string | null;
  redes_sociales: { red: string; url: string }[];
  servicios: { tipo: string; pack: string | null; pack_detalle: Record<string, unknown> | null }[];
  documentos: ClientDocSummary[];
  posts_anteriores: { titulo: string; copy: string | null; tipo: string; red: string }[];
}

/**
 * Genera sugerencias de contenido para una publicación nueva, usando
 * todo el contexto disponible del cliente: notas, documentos (sólo
 * metadata por ahora), servicios contratados, redes activas y posts
 * recientes para mantener consistencia de voz.
 */
export async function suggestPublicationContent(args: {
  cliente_id: string;
  tipo: string;
  red: string;
  hint?: string;
}): Promise<{ ok: true; suggestion: AISuggestion } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Falta ANTHROPIC_API_KEY en el server." };
  }
  await requireUser();

  const sb = createClient();

  // Traer contexto del cliente
  const [
    { data: cli },
    { data: services },
    { data: docs },
    { data: lastPubs },
  ] = await Promise.all([
    sb
      .from("clients")
      .select("nombre, rubro, pack, notas, redes_sociales")
      .eq("id", args.cliente_id)
      .maybeSingle(),
    sb
      .from("client_services")
      .select("tipo, pack, pack_detalle")
      .eq("cliente_id", args.cliente_id)
      .eq("activo", true),
    sb
      .from("documents")
      .select("titulo, categoria, descripcion")
      .eq("cliente_id", args.cliente_id)
      .eq("usar_en_ia", true),
    sb
      .from("publications")
      .select("titulo, copy, tipo, red")
      .eq("cliente_id", args.cliente_id)
      .order("fecha_publicacion", { ascending: false })
      .limit(6),
  ]);

  if (!cli) return { error: "Cliente no encontrado" };

  const ctx: ClientContext = {
    nombre: cli.nombre,
    rubro: cli.rubro,
    pack: cli.pack,
    notas: cli.notas,
    redes_sociales: (cli.redes_sociales ?? []) as { red: string; url: string }[],
    servicios: (services ?? []) as ClientContext["servicios"],
    documentos: (docs ?? []) as ClientDocSummary[],
    posts_anteriores: (lastPubs ?? []) as ClientContext["posts_anteriores"],
  };

  const system = `Sos el director creativo asistente de JD Media, una agencia de marketing digital cordobesa.
Tu trabajo: proponer ideas de contenido alineadas a la marca del cliente.

Devolvés un JSON ESTRICTO con esta forma:
{
  "titulo": "string corto y descriptivo (interno, no se publica)",
  "copy": "string con el texto que va junto al post; tono natural, sin clichés ni emojis exagerados",
  "hashtags": "5-10 hashtags separados por espacios",
  "descripcion": "string breve para el diseñador: qué imagen/visual proponés",
  "guion": "string con guion completo dialogado SI el tipo es reel/video, sino null",
  "notas": "string con razonamiento corto: por qué esta idea encaja con el cliente"
}

NO incluyas markdown, comentarios, ni texto fuera del JSON.
Hablás en español rioplatense (vos). Sin saludos, sin emojis innecesarios.`;

  const userPrompt = buildPrompt(ctx, args.tipo, args.red, args.hint);

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Intentar parsear JSON. Si viene rodeado por algo, extraemos el primer {…}.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "La IA no devolvió JSON válido." };
    const parsed = JSON.parse(jsonMatch[0]) as Partial<AISuggestion>;

    return {
      ok: true,
      suggestion: {
        titulo: String(parsed.titulo ?? ""),
        copy: String(parsed.copy ?? ""),
        hashtags: String(parsed.hashtags ?? ""),
        descripcion: String(parsed.descripcion ?? ""),
        guion: parsed.guion ? String(parsed.guion) : null,
        notas: String(parsed.notas ?? ""),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error con la IA" };
  }
}

function buildPrompt(
  ctx: ClientContext,
  tipo: string,
  red: string,
  hint: string | undefined
): string {
  const lines: string[] = [];
  lines.push(`# Cliente: ${ctx.nombre}`);
  if (ctx.rubro) lines.push(`Rubro: ${ctx.rubro}`);
  if (ctx.pack) lines.push(`Pack contratado: ${ctx.pack}`);
  if (ctx.servicios.length > 0) {
    lines.push(
      `Servicios activos: ${ctx.servicios
        .map((s) => `${s.tipo}${s.pack ? ` (${s.pack})` : ""}`)
        .join(", ")}`
    );
  }
  if (ctx.redes_sociales.length > 0) {
    lines.push(
      `Redes del cliente: ${ctx.redes_sociales.map((r) => r.red).join(", ")}`
    );
  }
  if (ctx.notas) {
    lines.push("");
    lines.push("## Notas internas del cliente");
    lines.push(ctx.notas);
  }
  if (ctx.documentos.length > 0) {
    lines.push("");
    lines.push("## Documentos del cliente disponibles (referencia)");
    for (const d of ctx.documentos) {
      lines.push(
        `- [${d.categoria}] ${d.titulo}${d.descripcion ? ` — ${d.descripcion}` : ""}`
      );
    }
    lines.push(
      "(Si necesitás contenido específico del brief/diagnóstico, asumí lineamientos consistentes con el rubro.)"
    );
  }
  if (ctx.posts_anteriores.length > 0) {
    lines.push("");
    lines.push("## Posts recientes (para mantener consistencia de voz)");
    for (const p of ctx.posts_anteriores) {
      if (!p.copy) continue;
      lines.push(`- ${p.tipo}/${p.red}: ${p.titulo}`);
      lines.push(`  copy: ${p.copy.slice(0, 240)}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`# Pieza a crear`);
  lines.push(`Tipo: ${tipo}`);
  lines.push(`Red: ${red}`);
  if (hint && hint.trim()) {
    lines.push(`Idea/tema del usuario: ${hint.trim()}`);
  } else {
    lines.push(
      "Sin tema específico — proponé una idea original alineada al rubro y al tono del cliente."
    );
  }
  lines.push("");
  lines.push("Devolvé el JSON con la sugerencia.");
  return lines.join("\n");
}
