"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isStaffUser } from "@/lib/auth";
import { AI_MODEL_FAST } from "@/lib/ai/models";

const MODEL = AI_MODEL_FAST;
const MAX_BYTES = 12 * 1024 * 1024; // 12MB

/**
 * Lee el documento del storage y le pide a la IA un resumen denso,
 * orientado a uso posterior como contexto creativo de cliente.
 * Lo guarda en documents.texto_extraido.
 */
export async function summarizeClientDocument(documentId: string): Promise<
  { ok: true; chars: number } | { error: string }
> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Falta ANTHROPIC_API_KEY" };
  }
  const me = await requireUser();
  if (!isStaffUser(me)) return { error: "Solo staff" };

  const sb = createClient();
  const { data: doc, error: dErr } = await sb
    .from("documents")
    .select("id, cliente_id, titulo, categoria, descripcion, storage_path, file_size, mime_type")
    .eq("id", documentId)
    .maybeSingle();
  if (dErr || !doc) return { error: "Documento no encontrado" };
  if (!doc.cliente_id) return { error: "El documento no está asignado a un cliente" };

  // Bajar el blob
  if (doc.file_size && doc.file_size > MAX_BYTES) {
    return { error: `Archivo muy grande (>${Math.round(MAX_BYTES / 1024 / 1024)}MB)` };
  }
  const { data: blob, error: dlErr } = await sb.storage
    .from("documents")
    .download(doc.storage_path);
  if (dlErr || !blob) return { error: "No se pudo descargar el archivo" };

  const ab = await blob.arrayBuffer();
  const base64 = Buffer.from(ab).toString("base64");
  const mime = (doc.mime_type ?? "").toLowerCase();

  // Armar bloque según tipo
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (mime === "application/pdf" || /\.pdf$/i.test(doc.storage_path)) {
    blocks.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
      title: doc.titulo,
    } as unknown as Anthropic.ContentBlockParam);
  } else if (
    mime.startsWith("text/") ||
    /\.(txt|md|csv)$/i.test(doc.storage_path)
  ) {
    const text = Buffer.from(ab).toString("utf-8").slice(0, 100_000);
    blocks.push({ type: "text", text: `Documento:\n\n${text}` });
  } else if (mime.startsWith("image/")) {
    return { error: "Las imágenes no se resumen (la IA las ve directo)." };
  } else {
    return { error: `Formato no soportado: ${mime || "?"}` };
  }

  blocks.push({
    type: "text",
    text: `Generá un resumen ESTRUCTURADO del documento "${doc.titulo}" (${doc.categoria}) para usarlo después como contexto al sugerir contenido para este cliente.

Devolvé en markdown, máximo ~1200 palabras, secciones:
- **Propuesta de valor del cliente** (qué ofrece / qué lo hace único)
- **Buyer persona / público objetivo** (datos demográficos, dolores, motivaciones)
- **Pilares de contenido** (temas/ejes a comunicar)
- **Tono y estilo de comunicación** (formal/casual, prohibido/permitido)
- **Datos del rubro y mercado** relevantes para diferenciarse
- **Productos / servicios destacados**
- **Cualquier otra info útil para escribir copy alineado** (frases típicas, claims, etc.)

Si el documento no tiene alguna sección, ponela como "—" pero no inventes.
NO incluyas saludos ni meta-explicación. Empezá directo con el contenido.`,
  });

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: blocks }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text || text.length < 50) {
      return { error: "La IA devolvió un resumen vacío" };
    }

    const { error: uErr } = await sb
      .from("documents")
      .update({
        texto_extraido: text,
        texto_extraido_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    if (uErr) return { error: uErr.message };

    revalidatePath(`/clientes/${doc.cliente_id}`);
    return { ok: true, chars: text.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error con la IA" };
  }
}
