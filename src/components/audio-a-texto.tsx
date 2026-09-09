"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grabar o subir un audio y recibirlo como texto.
 *
 * El caso que lo motivó: los prospectos contestan por WhatsApp con notas de
 * voz, no escribiendo. Antes había que escucharlas y resumirlas a mano para
 * poder pegar algo en el cuadro de contexto; ahora se sube el audio y la
 * transcripción entra sola.
 *
 * Sirve igual para dictar uno mismo, que es más rápido que tipear la charla
 * entera de una reunión.
 *
 * Devuelve SIEMPRE texto editable: la transcripción se revisa antes de
 * mandarla a la IA, porque los nombres propios y los números salen mal seguido.
 */
export function AudioATexto({
  onTexto,
  disabled,
  className,
}: {
  /** Se llama con la transcripción. Quien la usa decide si reemplaza o agrega. */
  onTexto: (texto: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function empezar() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no permite grabar. Subí el archivo de audio.");
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
        // Sin esto el navegador deja el indicador de micrófono prendido.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        await transcribir(blob, "grabacion.webm");
      };
      recorderRef.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      toast.error("No pudimos acceder al micrófono.");
    }
  }

  function parar() {
    recorderRef.current?.stop();
    setGrabando(false);
  }

  async function transcribir(blob: Blob, nombre: string) {
    if (blob.size > 25 * 1024 * 1024) {
      toast.error("El audio supera los 25 MB.");
      return;
    }
    setTranscribiendo(true);
    try {
      const form = new FormData();
      form.set("file", blob, nombre);
      const res = await fetch("/api/transcribe-audio", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo transcribir.");
      const texto = String(json.text ?? "").trim();
      if (!texto) throw new Error("La transcripción salió vacía.");
      onTexto(texto);
      toast.success("Audio transcripto. Revisalo antes de seguir.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo transcribir.");
    } finally {
      setTranscribiendo(false);
    }
  }

  const ocupado = disabled || transcribiendo;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={grabando ? parar : empezar}
        disabled={ocupado}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50",
          grabando
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            : "hover:bg-accent"
        )}
      >
        {grabando ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            Detener
            <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" /> Grabar audio
          </>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void transcribir(f, f.name);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={ocupado || grabando}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" /> Subir audio
      </button>

      {transcribiendo && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo…
        </span>
      )}
    </div>
  );
}
