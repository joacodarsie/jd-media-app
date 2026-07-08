import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Modelo de transcripción: flash estándar (multimodal, acepta audio inline).
// Es aparte del modelo "live" de la voz de JDmedIA.
const TRANSCRIBE_MODEL = "gemini-2.5-flash";

// Formatos de audio que aceptamos (grabados en el navegador o subidos).
const OK_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
]);

/**
 * POST /api/diagnostico/transcribe-audio
 *
 * Multipart form-data: { file: audio }
 * Transcribe con Gemini a texto plano en español. Devuelve { text }.
 *
 * Se usa en la sección de correcciones del diagnóstico: el admin graba/sube el
 * audio con lo que le dijo el cliente y lo dejamos como texto editable antes de
 * mandarlo a la revisión con IA.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar la transcripción de audio (GOOGLE_AI_API_KEY). Escribí las correcciones a mano por ahora." },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el audio (campo 'file')." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "El audio supera los 25 MB. Grabá algo más corto." }, { status: 400 });
  }

  // El navegador manda audio/webm;codecs=opus → tomamos la parte base.
  const mimeType = (file.type || "audio/webm").split(";")[0].trim();
  if (!OK_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Formato de audio no soportado (${mimeType}). Usá webm, mp3, m4a, wav u ogg.` },
      { status: 400 }
    );
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

    const res = await ai.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Transcribí este audio en español rioplatense, tal como se dice. " +
                "Devolvé SOLO la transcripción, sin comentarios, sin comillas y sin encabezados.",
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    });

    const text = (res.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "No se pudo transcribir el audio (¿se escucha bien?). Probá de nuevo o escribí a mano." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[diagnostico/transcribe-audio] error", err);
    return NextResponse.json(
      { error: "Error al transcribir el audio. Probá de nuevo o escribí las correcciones a mano." },
      { status: 500 }
    );
  }
}
