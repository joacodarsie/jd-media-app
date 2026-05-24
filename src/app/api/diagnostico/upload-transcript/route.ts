import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/diagnostico/upload-transcript
 *
 * Multipart form-data:
 *   - file:       PDF de Tactiq (transcript del meet)
 *   - cliente_id: UUID del cliente
 *
 * Devuelve { transcript_text, source_pdf_path } para que el cliente pueda
 * pre-llenar el editor y luego invocar /generate.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const cliente_id = String(form.get("cliente_id") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el PDF (campo 'file')." }, { status: 400 });
  }
  if (!cliente_id) {
    return NextResponse.json({ error: "Falta cliente_id." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "El PDF supera los 20 MB." }, { status: 400 });
  }

  const admin = createAdmin();

  // Verificar acceso del usuario al cliente (RLS de clients aplica vía supabase no-admin).
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", cliente_id)
    .maybeSingle();
  if (clientErr || !client) {
    return NextResponse.json({ error: "Cliente no encontrado o sin acceso." }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Extraer texto con unpdf (serverless-friendly, sin deps nativas).
  let transcript_text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    transcript_text = Array.isArray(text) ? text.join("\n\n") : text;
    transcript_text = transcript_text.trim();
  } catch (err) {
    console.error("[diagnostico/upload-transcript] PDF parse failed", err);
    return NextResponse.json(
      { error: "No se pudo leer el PDF. ¿Es texto seleccionable?" },
      { status: 422 }
    );
  }

  if (transcript_text.length < 200) {
    return NextResponse.json(
      {
        error:
          "La transcripción extraída es muy corta (<200 caracteres). Verificá que el PDF contenga texto, no solo imágenes.",
      },
      { status: 422 }
    );
  }

  // Subir el PDF original al bucket (para auditoría/reproceso).
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const source_pdf_path = `${cliente_id}/${ts}__${safeName}`;

  const { error: uploadErr } = await admin.storage
    .from("diagnostic-sources")
    .upload(source_pdf_path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    console.error("[diagnostico/upload-transcript] storage upload failed", uploadErr);
    // No bloqueamos el flujo si solo falla el archivado; devolvemos el texto igual.
  }

  return NextResponse.json({
    transcript_text,
    source_pdf_path: uploadErr ? null : source_pdf_path,
    chars: transcript_text.length,
  });
}
