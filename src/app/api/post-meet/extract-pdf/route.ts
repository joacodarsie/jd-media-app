import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/post-meet/extract-pdf
 *
 * Multipart form-data:
 *   - file: PDF de transcripción (Tactiq u otro)
 *
 * Devuelve { text } con el texto extraído para precargar el textarea
 * del post-meet workspace.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el PDF." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "El PDF supera los 15 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    text = text.trim();
  } catch (err) {
    console.error("[post-meet/extract-pdf] parse failed", err);
    return NextResponse.json(
      { error: "No se pudo leer el PDF. ¿Es texto seleccionable?" },
      { status: 422 }
    );
  }

  if (text.length < 30) {
    return NextResponse.json(
      {
        error:
          "El texto extraído es muy corto. Verificá que el PDF contenga texto, no solo imágenes.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ text });
}
