"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  ImagePlus,
  Mic,
  Square,
  Upload,
  X,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  clienteId: string;
  baseDiagnosticId: string;
}

interface PickedImage {
  id: string;
  name: string;
  media_type: string;
  data: string; // base64 sin prefijo data:
  preview: string; // data URL para el <img>
}

const OK_IMAGE = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGES = 6;

/** Lee un File de imagen a base64 (sin el prefijo data:...;base64,). */
function readImage(file: File): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const comma = url.indexOf(",");
      resolve({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        media_type: file.type,
        data: url.slice(comma + 1),
        preview: url,
      });
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

export function DiagnosticCorrections({ clienteId, baseDiagnosticId }: Props) {
  const [texto, setTexto] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Audio
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function addImages(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} capturas.`);
      return;
    }
    const picked: PickedImage[] = [];
    for (const f of incoming.slice(0, room)) {
      if (!OK_IMAGE.includes(f.type)) {
        toast.error(`"${f.name}" no es una imagen válida (PNG, JPG, WEBP o GIF).`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`"${f.name}" supera los 8 MB.`);
        continue;
      }
      try {
        picked.push(await readImage(f));
      } catch {
        toast.error(`No se pudo leer "${f.name}".`);
      }
    }
    if (picked.length > 0) setImages((prev) => [...prev, ...picked]);
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  // ── Audio: grabar con el micrófono ──
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no permite grabar audio. Subí un archivo o escribí a mano.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        await transcribe(blob, "grabacion.webm");
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("No pudimos acceder al micrófono.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function onUploadAudio(file: File | undefined) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("El audio supera los 25 MB.");
      return;
    }
    await transcribe(file, file.name);
  }

  async function transcribe(blob: Blob, filename: string) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.set("file", blob, filename);
      const res = await fetch("/api/diagnostico/transcribe-audio", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error transcribiendo");
      const t = String(json.text ?? "").trim();
      if (!t) throw new Error("Transcripción vacía.");
      setTexto((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t));
      toast.success("Audio transcripto. Revisá el texto antes de aplicar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al transcribir.");
    } finally {
      setTranscribing(false);
    }
  }

  // ── Aplicar correcciones con IA (SSE) ──
  async function apply() {
    if (!texto.trim() && images.length === 0) {
      toast.error("Cargá al menos una corrección: texto, audio o captura.");
      return;
    }
    if (!confirm("¿Aplicar las correcciones con IA? Se crea una versión nueva en borrador para que la revises antes de aprobar.")) {
      return;
    }
    setApplying(true);
    setProgress(0);
    try {
      const res = await fetch("/api/diagnostico/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          base_diagnostic_id: baseDiagnosticId,
          correcciones: texto.trim(),
          images: images.map((i) => ({ media_type: i.media_type, data: i.data })),
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done: { version: number } | null = null;
      let errMsg: string | null = null;

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as { type: string; [k: string]: unknown };
              if (evt.type === "progress") setProgress(typeof evt.chars === "number" ? evt.chars : 0);
              else if (evt.type === "saving") setProgress(-1);
              else if (evt.type === "done") done = { version: (evt.version as number) ?? 0 };
              else if (evt.type === "error") errMsg = (evt.error as string) ?? "Error en la revisión";
            } catch {
              /* ignorada */
            }
          }
        }
      }

      if (errMsg) throw new Error(errMsg);
      if (done) {
        toast.success(`Revisión v${done.version} lista. Cargando el borrador…`);
        window.location.reload();
      } else {
        throw new Error("La revisión terminó sin resultado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar correcciones.");
      setApplying(false);
    }
  }

  if (applying) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {progress === -1
              ? "Guardando la nueva versión…"
              : progress > 0
              ? `Aplicando correcciones… ${progress.toLocaleString()} caracteres`
              : "Analizando las correcciones con IA (60-90 segundos)…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-5 w-5 text-primary" />
          Correcciones del cliente
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ¿El cliente te pidió cambios sobre el informe que le mandaste? Cargalos
          acá —escribilos, pegá capturas de lo que te marcó o subí/grabá un audio— y
          la IA arma una <strong>versión corregida en borrador</strong> para que la
          revises y apruebes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Ej: “No somos una sola persona, somos 3 socios.” · “Sacá lo de TikTok, no lo vamos a hacer.” · “El público principal son empresas, no consumidores finales.”"
        />

        {/* Capturas */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={img.name}
                  className="h-20 w-20 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                  aria-label="Quitar captura"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Adjuntar capturas */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <ImagePlus className="h-4 w-4" /> Captura
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {/* Grabar audio */}
          {!recording ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startRecording}
              disabled={transcribing}
            >
              <Mic className="mr-1.5 h-4 w-4" /> Grabar audio
            </Button>
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="mr-1.5 h-4 w-4" /> Detener y transcribir
            </Button>
          )}

          {/* Subir audio */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" /> Subir audio
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                onUploadAudio(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          {transcribing && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Transcribiendo…
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            El audio se transcribe y se agrega al texto de arriba; podés editarlo
            antes de aplicar.
          </p>
          <Button onClick={apply} disabled={transcribing}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Aplicar correcciones con IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
