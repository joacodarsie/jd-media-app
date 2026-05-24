"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const MODEL = "claude-sonnet-4-6";

// Límites para no explotar el contexto / billing
const MAX_DOCS_TO_READ = 4;
const MAX_BYTES_PER_DOC = 8 * 1024 * 1024; // 8MB
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB combinados

export interface AISuggestion {
  titulo: string;
  copy: string;
  hashtags: string;
  descripcion: string;
  guion: string | null;
  notas: string;
}

interface DocRow {
  id: string;
  titulo: string;
  categoria: string;
  descripcion: string | null;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  texto_extraido: string | null;
}

interface ClientContext {
  nombre: string;
  rubro: string | null;
  pack: string | null;
  notas: string | null;
  redes_sociales: { red: string; url: string }[];
  servicios: { tipo: string; pack: string | null; pack_detalle: Record<string, unknown> | null }[];
  posts_publicados: { titulo: string; copy: string | null; tipo: string; red: string; fecha: string | null }[];
  posts_planificados: { titulo: string; copy: string | null; tipo: string; red: string; fecha: string | null; estado: string }[];
  diagnostico: {
    version: number;
    resumen_ejecutivo?: unknown;
    contexto?: unknown;
    publico_objetivo?: unknown;
    marca?: unknown;
    diferenciales?: unknown;
    pilares_contenido?: unknown;
  } | null;
  plan_mensual: {
    periodo_label: string;
    mix_por_red?: unknown;
    distribucion_pilares?: unknown;
    temas_destacados?: unknown;
    campanas?: unknown;
    reglas_operativas?: unknown;
  } | null;
}

export async function suggestPublicationContent(args: {
  cliente_id: string;
  tipo: string;
  red: string;
  hint?: string;
}): Promise<{ ok: true; suggestion: AISuggestion; docsUsed: string[] } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Falta ANTHROPIC_API_KEY en el server." };
  }
  await requireUser();

  const sb = createClient();

  const [
    { data: cli },
    { data: services },
    { data: docs },
    { data: publishedPubs },
    { data: pipelinePubs },
    { data: diagRow },
    { data: planRow },
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
      .select(
        "id, titulo, categoria, descripcion, storage_path, file_size, mime_type, texto_extraido"
      )
      .eq("cliente_id", args.cliente_id)
      .eq("usar_en_ia", true)
      .order("created_at", { ascending: false })
      .limit(MAX_DOCS_TO_READ * 2),
    // Historial: todo lo subido en los últimos 90 días.
    sb
      .from("publications")
      .select("titulo, copy, tipo, red, fecha_publicacion")
      .eq("cliente_id", args.cliente_id)
      .eq("estado", "publicado")
      .order("fecha_publicacion", { ascending: false })
      .limit(15),
    // Pipeline: lo que está planificado / en producción / a punto de salir.
    sb
      .from("publications")
      .select("titulo, copy, tipo, red, fecha_publicacion, estado")
      .eq("cliente_id", args.cliente_id)
      .not("estado", "eq", "publicado")
      .order("fecha_publicacion", { ascending: true, nullsFirst: false })
      .limit(15),
    sb
      .from("client_diagnostics")
      .select("version, content")
      .eq("cliente_id", args.cliente_id)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("client_content_plans")
      .select("periodo_label, content")
      .eq("cliente_id", args.cliente_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!cli) return { error: "Cliente no encontrado" };

  let diagnostico: ClientContext["diagnostico"] = null;
  if (diagRow && diagRow.content && typeof diagRow.content === "object") {
    const c = diagRow.content as Record<string, unknown>;
    diagnostico = {
      version: diagRow.version,
      resumen_ejecutivo: c.resumen_ejecutivo,
      contexto: c.contexto,
      publico_objetivo: c.publico_objetivo,
      marca: c.marca,
      diferenciales: c.diferenciales,
      pilares_contenido: c.pilares_contenido,
    };
  }

  let plan_mensual: ClientContext["plan_mensual"] = null;
  if (planRow && planRow.content && typeof planRow.content === "object") {
    const p = planRow.content as Record<string, unknown>;
    plan_mensual = {
      periodo_label: planRow.periodo_label,
      mix_por_red: p.mix_por_red,
      distribucion_pilares: p.distribucion_pilares,
      temas_destacados: p.temas_destacados,
      campanas: p.campanas,
      reglas_operativas: p.reglas_operativas,
    };
  }

  const ctx: ClientContext = {
    nombre: cli.nombre,
    rubro: cli.rubro,
    pack: cli.pack,
    notas: cli.notas,
    redes_sociales: (cli.redes_sociales ?? []) as { red: string; url: string }[],
    servicios: (services ?? []) as ClientContext["servicios"],
    posts_publicados: ((publishedPubs ?? []) as Array<{
      titulo: string;
      copy: string | null;
      tipo: string;
      red: string;
      fecha_publicacion: string | null;
    }>).map((p) => ({
      titulo: p.titulo,
      copy: p.copy,
      tipo: p.tipo,
      red: p.red,
      fecha: p.fecha_publicacion,
    })),
    plan_mensual,
    posts_planificados: ((pipelinePubs ?? []) as Array<{
      titulo: string;
      copy: string | null;
      tipo: string;
      red: string;
      fecha_publicacion: string | null;
      estado: string;
    }>).map((p) => ({
      titulo: p.titulo,
      copy: p.copy,
      tipo: p.tipo,
      red: p.red,
      fecha: p.fecha_publicacion,
      estado: p.estado,
    })),
    diagnostico,
  };

  // Bajar documentos del storage y armar blocks
  const docRows = (docs ?? []) as DocRow[];
  const docBlocks: Anthropic.ContentBlockParam[] = [];
  const docsUsed: string[] = [];
  const docsSkipped: { titulo: string; reason: string }[] = [];
  let totalBytes = 0;

  for (const d of docRows) {
    if (docsUsed.length >= MAX_DOCS_TO_READ) {
      docsSkipped.push({ titulo: d.titulo, reason: "límite de docs alcanzado" });
      continue;
    }

    // Fast path: si ya tenemos texto_extraido, lo usamos sin re-descargar el PDF.
    if (d.texto_extraido && d.texto_extraido.trim().length > 50) {
      docBlocks.push({
        type: "text",
        text: `[Resumen estructurado de "${d.titulo}" (${d.categoria})${d.descripcion ? ` — ${d.descripcion}` : ""}]\n---\n${d.texto_extraido}\n---`,
      });
      docsUsed.push(d.titulo + " (resumen)");
      continue;
    }

    const sizeOk = !d.file_size || d.file_size <= MAX_BYTES_PER_DOC;
    if (!sizeOk) {
      docsSkipped.push({ titulo: d.titulo, reason: "archivo muy grande" });
      continue;
    }

    const { data: blob, error: dlErr } = await sb.storage
      .from("documents")
      .download(d.storage_path);
    if (dlErr || !blob) {
      docsSkipped.push({ titulo: d.titulo, reason: "no se pudo descargar" });
      continue;
    }
    const ab = await blob.arrayBuffer();
    const size = ab.byteLength;
    if (totalBytes + size > MAX_TOTAL_BYTES) {
      docsSkipped.push({ titulo: d.titulo, reason: "excede tamaño combinado" });
      continue;
    }
    totalBytes += size;

    const mime = (d.mime_type ?? "").toLowerCase();
    const base64 = Buffer.from(ab).toString("base64");

    // PDF → document block nativo
    if (mime === "application/pdf" || /\.pdf$/i.test(d.storage_path)) {
      docBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
        title: d.titulo,
        context: `Categoría: ${d.categoria}${d.descripcion ? ` — ${d.descripcion}` : ""}`,
      } as unknown as Anthropic.ContentBlockParam);
      docsUsed.push(d.titulo);
      continue;
    }

    // Imagen → image block
    if (mime.startsWith("image/")) {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowed.includes(mime)) {
        docsSkipped.push({ titulo: d.titulo, reason: "imagen de formato no soportado" });
        continue;
      }
      docBlocks.push({
        type: "text",
        text: `[Imagen adjunta — ${d.titulo} (${d.categoria})${d.descripcion ? ` · ${d.descripcion}` : ""}]`,
      });
      docBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64,
        },
      });
      docsUsed.push(d.titulo);
      continue;
    }

    // Texto plano / CSV / Markdown → text block con el contenido
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      /\.(txt|md|csv|json)$/i.test(d.storage_path)
    ) {
      const text = Buffer.from(ab).toString("utf-8").slice(0, 60_000);
      docBlocks.push({
        type: "text",
        text:
          `[Documento adjunto: ${d.titulo} (${d.categoria})${d.descripcion ? ` — ${d.descripcion}` : ""}]\n---\n${text}\n---`,
      });
      docsUsed.push(d.titulo);
      continue;
    }

    docsSkipped.push({ titulo: d.titulo, reason: `formato no soportado (${mime || "?"})` });
  }

  const system = `Sos el director creativo asistente de JD Media, una agencia de marketing digital cordobesa.
Tu trabajo: proponer ideas de contenido alineadas a la marca del cliente, leyendo a fondo el diagnóstico estratégico, los documentos adjuntos y el historial del calendario.

# Reglas de oro
1. **Respetá el diagnóstico** — la pieza tiene que encajar en uno de los pilares definidos, hablarle al público objetivo y mantener el tono.
2. **NO repitas** ideas, ángulos, ganchos o copys que ya aparezcan en el calendario (publicados o planificados). Si vas a tocar un tema usado, encaralo desde otra perspectiva.
3. **Concreto, no vago** — "un reel sobre el día a día" está MAL. "Un reel mostrando a Nico estudiando con la canción nueva de fondo durante semana de parciales" está BIEN.
4. **El copy tiene que sonar como el cliente, no como IA**. Usá las frases representativas del brief si las hay.

Devolvés un JSON ESTRICTO con esta forma:
{
  "titulo": "string corto y descriptivo (interno, no se publica)",
  "copy": "string con el texto que va junto al post; tono natural, sin clichés ni emojis exagerados",
  "hashtags": "5-10 hashtags separados por espacios",
  "descripcion": "string breve para el diseñador: qué imagen/visual proponés",
  "guion": "string con guion completo dialogado SI el tipo es reel/video, sino null",
  "notas": "string con razonamiento corto: por qué esta idea encaja con el cliente. Si usaste info concreta de los documentos adjuntos, mencionalo."
}

NO incluyas markdown, comentarios, ni texto fuera del JSON.
Hablás en español rioplatense (vos). Sin saludos, sin emojis innecesarios.`;

  const userTextPrompt = buildPrompt(ctx, args.tipo, args.red, args.hint, docsUsed, docsSkipped);

  // Mensaje user: primero los documentos (si hay), después el prompt textual
  const userContent: Anthropic.ContentBlockParam[] = [
    ...docBlocks,
    { type: "text", text: userTextPrompt },
  ];

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

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
      docsUsed,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error con la IA" };
  }
}

function buildPrompt(
  ctx: ClientContext,
  tipo: string,
  red: string,
  hint: string | undefined,
  docsUsed: string[],
  docsSkipped: { titulo: string; reason: string }[]
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
  if (ctx.plan_mensual) {
    lines.push("");
    lines.push(`## PLAN DEL PERÍODO — "${ctx.plan_mensual.periodo_label}" (capa operativa)`);
    lines.push(
      "Esta es la estrategia operativa vigente para este cliente. La pieza tiene que ENCAJAR en el mix, en uno de los pilares con su peso, y respetar las reglas operativas. Si hay temas destacados del período, priorizalos antes de inventar otros."
    );
    if (ctx.plan_mensual.distribucion_pilares) {
      lines.push("");
      lines.push("### Distribución por pilar");
      lines.push(JSON.stringify(ctx.plan_mensual.distribucion_pilares));
    }
    if (ctx.plan_mensual.mix_por_red) {
      lines.push("");
      lines.push("### Mix por red (cadencia mensual)");
      lines.push(JSON.stringify(ctx.plan_mensual.mix_por_red));
    }
    if (ctx.plan_mensual.temas_destacados) {
      lines.push("");
      lines.push("### Temas destacados del período");
      lines.push(JSON.stringify(ctx.plan_mensual.temas_destacados));
    }
    if (ctx.plan_mensual.campanas) {
      lines.push("");
      lines.push("### Campañas activas");
      lines.push(JSON.stringify(ctx.plan_mensual.campanas));
    }
    if (ctx.plan_mensual.reglas_operativas) {
      lines.push("");
      lines.push("### Reglas operativas");
      lines.push(JSON.stringify(ctx.plan_mensual.reglas_operativas));
    }
  }
  if (ctx.diagnostico) {
    lines.push("");
    lines.push(`## BRIEF ESTRATÉGICO — Diagnóstico inicial aprobado (v${ctx.diagnostico.version})`);
    lines.push(
      "Esta es la fuente de verdad del cliente. Aplicá EL TONO, los PILARES y el PÚBLICO definidos acá."
    );
    if (ctx.diagnostico.resumen_ejecutivo) {
      lines.push("");
      lines.push("### Resumen ejecutivo");
      lines.push(JSON.stringify(ctx.diagnostico.resumen_ejecutivo));
    }
    if (ctx.diagnostico.contexto) {
      lines.push("");
      lines.push("### Contexto del negocio");
      lines.push(JSON.stringify(ctx.diagnostico.contexto));
    }
    if (ctx.diagnostico.publico_objetivo) {
      lines.push("");
      lines.push("### Público objetivo");
      lines.push(JSON.stringify(ctx.diagnostico.publico_objetivo));
    }
    if (ctx.diagnostico.marca) {
      lines.push("");
      lines.push("### Marca y tono de voz");
      lines.push(JSON.stringify(ctx.diagnostico.marca));
    }
    if (ctx.diagnostico.diferenciales) {
      lines.push("");
      lines.push("### Diferenciales");
      lines.push(JSON.stringify(ctx.diagnostico.diferenciales));
    }
    if (ctx.diagnostico.pilares_contenido) {
      lines.push("");
      lines.push("### Pilares de contenido (la pieza tiene que encajar en uno)");
      lines.push(JSON.stringify(ctx.diagnostico.pilares_contenido));
    }
  }
  if (ctx.notas) {
    lines.push("");
    lines.push("## Notas internas del cliente");
    lines.push(ctx.notas);
  }
  if (docsUsed.length > 0) {
    lines.push("");
    lines.push(`## Documentos adjuntados a este mensaje (${docsUsed.length})`);
    docsUsed.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
    lines.push(
      "Leé los documentos con atención. Usá lo que esté ahí (pilares de contenido, tono, buyer persona, propuesta de valor, datos del rubro) para que la sugerencia esté alineada al cliente, no genérica."
    );
  }
  if (docsSkipped.length > 0) {
    lines.push("");
    lines.push(`(Nota: ${docsSkipped.length} documento(s) no se pudieron incluir: ${docsSkipped
      .map((d) => `${d.titulo} — ${d.reason}`)
      .join("; ")})`);
  }
  if (ctx.posts_publicados.length > 0 || ctx.posts_planificados.length > 0) {
    lines.push("");
    lines.push("## CONTENIDO YA HECHO O PLANIFICADO — NO REPETIR");
    lines.push(
      "Las siguientes piezas ya existen para este cliente (publicadas o en el calendario). " +
      "Tu sugerencia tiene que ser un **ángulo o tema distinto**: cambiar pilar, momento, ocasión, " +
      "o enfoque. Si vas a tocar un tema que aparece abajo, hacelo desde otra perspectiva. " +
      "Mantené coherencia de voz, pero no repitas ideas, ganchos ni copys."
    );
    if (ctx.posts_publicados.length > 0) {
      lines.push("");
      lines.push(`### Ya publicadas (${ctx.posts_publicados.length})`);
      for (const p of ctx.posts_publicados) {
        const fecha = p.fecha ? p.fecha.slice(0, 10) : "—";
        lines.push(`- [${fecha}] ${p.tipo}/${p.red}: ${p.titulo}`);
        if (p.copy) lines.push(`  copy: ${p.copy.slice(0, 200)}`);
      }
    }
    if (ctx.posts_planificados.length > 0) {
      lines.push("");
      lines.push(`### Ya planificadas / en producción (${ctx.posts_planificados.length})`);
      for (const p of ctx.posts_planificados) {
        const fecha = p.fecha ? p.fecha.slice(0, 10) : "sin fecha";
        lines.push(`- [${fecha} · ${p.estado}] ${p.tipo}/${p.red}: ${p.titulo}`);
        if (p.copy) lines.push(`  copy: ${p.copy.slice(0, 200)}`);
      }
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
