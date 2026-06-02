"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Tipos mínimos de la Web Speech API (no están en lib.dom estándar) ──
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SRecognitionEvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}
type SRConstructor = new () => SRecognition;

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SUGERENCIAS = [
  "Reunión con Juan de ferretería tipo. Tienen IG pero suben poco. Buscan más clientes locales. Mencionó tener presupuesto entre 100k y 150k mensuales. Acordamos mandarle propuesta esta semana.",
  "Llamada con Marta. Tiene un emprendimiento de cosmética natural. No tiene marca fuerte, vende por WhatsApp. Quiere profesionalizar. No tiene urgencia, quiere arrancar el mes que viene. Pidió tiempo para pensarlo.",
];

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

const QUICK_TWEAKS = [
  "Hacelo más corto",
  "Cambialo a Pack Crecimiento",
  "Cambialo a Pack Escala",
  "Más informal",
  "Más formal",
  "Sin emojis",
  "Agregale que arrancamos esta semana",
];

interface AttachedImage {
  id: string;
  name: string;
  dataUrl: string;
  media_type: string;
  /** base64 sin el prefijo data: */
  data: string;
}

/** Hacia qué cuadro va el dictado por voz. */
type DictTarget = "context" | "instructions";

export function PostMeetWorkspace() {
  const [clientName, setClientName] = useState("");
  const [context, setContext] = useState("");
  const [instructions, setInstructions] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [tweakPrompt, setTweakPrompt] = useState("");
  const [tweaking, setTweaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Dictado: null = apagado, o el cuadro destino activo.
  const [dictating, setDictating] = useState<DictTarget | null>(null);
  const [srSupported, setSrSupported] = useState(false);
  const recognitionRef = useRef<SRecognition | null>(null);
  const dictatingRef = useRef(false);
  const dictTargetRef = useRef<DictTarget>("context");

  useEffect(() => {
    setSrSupported(!!getSpeechRecognition());
    return () => {
      dictatingRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  function startDictation(target: DictTarget) {
    const SR = getSpeechRecognition();
    if (!SR) {
      toast.error("Tu navegador no soporta dictado por voz. Probá con Chrome.");
      return;
    }
    dictTargetRef.current = target;
    const rec = new SR();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
      }
      if (finalChunk.trim()) {
        const setter = dictTargetRef.current === "instructions" ? setInstructions : setContext;
        setter((prev) =>
          (prev ? prev.replace(/\s*$/, "") + " " : "") + finalChunk.trim()
        );
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "no-speech" || ev?.error === "aborted") return;
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        toast.error("Permití el acceso al micrófono para dictar.");
        dictatingRef.current = false;
        setDictating(null);
      }
    };
    rec.onend = () => {
      // Chrome corta el reconocimiento tras un silencio; si el usuario sigue
      // dictando, lo reiniciamos para que sea continuo.
      if (dictatingRef.current) {
        try {
          rec.start();
        } catch {}
      } else {
        setDictating(null);
      }
    };
    recognitionRef.current = rec;
    dictatingRef.current = true;
    setDictating(target);
    try {
      rec.start();
    } catch {}
  }

  function stopDictation() {
    dictatingRef.current = false;
    setDictating(null);
    try {
      recognitionRef.current?.stop();
    } catch {}
  }

  function toggleDictation(target: DictTarget) {
    if (dictating === target) stopDictation();
    else if (dictating) {
      // Cambiar de cuadro: paramos el actual y arrancamos el nuevo.
      stopDictation();
      setTimeout(() => startDictation(target), 150);
    } else startDictation(target);
  }

  async function handlePdfFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tiene que ser un archivo .pdf");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("El PDF es muy grande (máx 15 MB)");
      return;
    }
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/post-meet/extract-pdf", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo leer el PDF");
        return;
      }
      setContext(data.text ?? "");
      setLastPdfName(file.name);
      toast.success("Transcripción cargada");
    } catch (e) {
      toast.error(
        "No se pudo subir el PDF: " + (e instanceof Error ? e.message : "")
      );
    } finally {
      setExtracting(false);
    }
  }

  function onDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault();
    setDragOver(false);
    const file = ev.dataTransfer.files?.[0];
    if (file) void handlePdfFile(file);
  }

  function onPickFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (file) void handlePdfFile(file);
    // Permitir re-seleccionar el mismo archivo
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo imágenes (captura, foto, etc.)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen es muy grande (máx 8 MB)");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    const media_type = dataUrl.slice(5, dataUrl.indexOf(";"));
    const data = dataUrl.slice(comma + 1);
    setImages((prev) =>
      prev.length >= 5
        ? (toast.error("Máximo 5 imágenes"), prev)
        : [...prev, { id: crypto.randomUUID(), name: file.name, dataUrl, media_type, data }]
    );
  }

  function onPickImages(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []);
    files.forEach((f) => void addImageFile(f));
    if (imgInputRef.current) imgInputRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((im) => im.id !== id));
  }

  /** Imágenes en el formato que espera la API. */
  function imagePayload() {
    return images.map((im) => ({ media_type: im.media_type, data: im.data }));
  }

  async function generate() {
    const text = context.trim();
    if (text.length < 30) {
      toast.error(
        "Pegá la transcripción o un resumen con al menos 30 caracteres."
      );
      return;
    }
    setLoading(true);
    setMessage(null);
    setHistory([]);
    setCopied(false);
    try {
      const res = await fetch("/api/post-meet-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: text,
          clientName: clientName.trim(),
          instructions: instructions.trim() || undefined,
          images: images.length ? imagePayload() : undefined,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error generando mensaje");
        return;
      }
      const reply = data.message ?? "";
      setMessage(reply);
      // Inicializamos el history conversacional para iterar despues.
      const extra = instructions.trim() ? `\n\nIndicaciones extra:\n${instructions.trim()}` : "";
      const imgNote = images.length ? `\n\n(+${images.length} imagen/es adjunta/s)` : "";
      const userText =
        (clientName.trim()
          ? `Cliente / contacto: ${clientName.trim()}\n\nTranscripcion / notas de la reunion:\n\n${text}`
          : `Transcripcion / notas de la reunion:\n\n${text}`) +
        extra +
        imgNote;
      setHistory([
        { role: "user", content: userText },
        { role: "assistant", content: reply },
      ]);
      setImages([]); // ya fueron enviadas con esta generación
    } catch (e) {
      toast.error("No se pudo generar: " + (e instanceof Error ? e.message : ""));
    } finally {
      setLoading(false);
    }
  }

  async function tweak(promptText?: string) {
    const prompt = (promptText ?? tweakPrompt).trim();
    if (!prompt) {
      toast.error("Decile a la IA qué querés cambiar.");
      return;
    }
    if (history.length === 0) {
      toast.error("Primero generá un mensaje base.");
      return;
    }
    setTweaking(true);
    try {
      const res = await fetch("/api/post-meet-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          userMessage: prompt,
          images: images.length ? imagePayload() : undefined,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error ajustando mensaje");
        return;
      }
      const reply = data.message ?? "";
      setMessage(reply);
      setHistory((h) => [
        ...h,
        { role: "user", content: prompt + (images.length ? ` (+${images.length} img)` : "") },
        { role: "assistant", content: reply },
      ]);
      setTweakPrompt("");
      setImages([]);
      setCopied(false);
      toast.success("Mensaje actualizado");
    } catch (e) {
      toast.error(
        "No se pudo ajustar: " + (e instanceof Error ? e.message : "")
      );
    } finally {
      setTweaking(false);
    }
  }

  function copyMessage() {
    if (!message) return;
    navigator.clipboard.writeText(message).then(
      () => {
        setCopied(true);
        toast.success("Mensaje copiado");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("No se pudo copiar")
    );
  }

  function clearAll() {
    setClientName("");
    setContext("");
    setInstructions("");
    setImages([]);
    setMessage(null);
    setHistory([]);
    setTweakPrompt("");
    setCopied(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <Label htmlFor="client-name" className="text-xs">
              Nombre del contacto (opcional)
            </Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="h-9"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label htmlFor="context" className="text-xs">
                Transcripción o resumen de la reunión
              </Label>
              <div className="flex items-center gap-3">
                {srSupported && (
                  <button
                    type="button"
                    onClick={() => toggleDictation("context")}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] hover:underline",
                      dictating === "context"
                        ? "font-medium text-red-600"
                        : "text-primary"
                    )}
                  >
                    {dictating === "context" ? (
                      <>
                        <span className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
                          <Square className="h-2.5 w-2.5 fill-current" />
                        </span>
                        Detener
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" />
                        Dictar
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extracting}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  Subir PDF
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={onPickFile}
                className="hidden"
              />
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!extracting) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "relative rounded-md border transition",
                dragOver
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-input bg-card"
              )}
            >
              <textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={10}
                placeholder="Pegá la transcripción completa de la meet, o arrastrá el PDF acá. También podés escribir un resumen con los puntos clave: qué hace el cliente, su dolor, sus objetivos, qué te pidió, próximos pasos…"
                className="min-h-[180px] w-full resize-y rounded-md bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {(extracting || dragOver) && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    {extracting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Leyendo PDF…
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Soltá el PDF acá
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                Cuanto más contexto, mejor el mensaje. La IA usa la voz de JD
                Media.
              </span>
              {lastPdfName && (
                <span className="inline-flex items-center gap-1 truncate text-primary/80">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{lastPdfName}</span>
                </span>
              )}
            </p>
          </div>

          {/* Indicaciones extra para la IA + imágenes (antes de generar) */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="instructions" className="text-xs">
                Indicaciones para la IA <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <div className="flex items-center gap-3">
                {srSupported && (
                  <button
                    type="button"
                    onClick={() => toggleDictation("instructions")}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] hover:underline",
                      dictating === "instructions" ? "font-medium text-red-600" : "text-primary"
                    )}
                  >
                    {dictating === "instructions" ? (
                      <>
                        <span className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
                          <Square className="h-2.5 w-2.5 fill-current" />
                        </span>
                        Detener
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" />
                        Grabar
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ImagePlus className="h-3 w-3" />
                  Imagen
                </button>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickImages}
                  className="hidden"
                />
              </div>
            </div>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Ej: el cliente también pidió una landing y branding, contemplá eso. Tono más formal. No menciones precio todavía…"
              className="min-h-[56px] w-full resize-y rounded-md border border-input bg-card p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((im) => (
                  <div key={im.id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.dataUrl}
                      alt={im.name}
                      className="h-16 w-16 rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(im.id)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white opacity-90 shadow hover:bg-red-700"
                      title="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} disabled={loading || context.length < 30}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar mensaje
                </>
              )}
            </Button>
            {(context || clientName || message) && (
              <Button
                variant="ghost"
                onClick={clearAll}
                disabled={loading}
                className="gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>

          {!context && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ¿No tenés transcripción? Probá con un ejemplo:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGERENCIAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setContext(s)}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-left text-[11px] hover:border-primary/40 hover:bg-primary/5"
                  >
                    Ejemplo {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {message && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Send className="h-3.5 w-3.5" />
                Mensaje listo
              </div>
              <Button
                size="sm"
                onClick={copyMessage}
                className="gap-1"
                variant={copied ? "outline" : "default"}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={Math.min(20, message.split("\n").length + 2)}
              className="w-full resize-y rounded-lg border bg-card p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {/* Tweaks rápidos */}
            <div className="border-t pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Pedile cambios a la IA
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_TWEAKS.map((t) => (
                  <button
                    key={t}
                    onClick={() => void tweak(t)}
                    disabled={tweaking || loading}
                    className="rounded-full border bg-card px-2.5 py-1 text-[11px] hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tweakPrompt}
                  onChange={(e) => setTweakPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !tweaking) {
                      e.preventDefault();
                      void tweak();
                    }
                  }}
                  placeholder="Ej: agregale que arrancamos el lunes, sacale los emojis…"
                  disabled={tweaking}
                  className="h-9 text-sm"
                />
                <Button
                  onClick={() => void tweak()}
                  disabled={tweaking || !tweakPrompt.trim()}
                  className="shrink-0"
                  size="sm"
                >
                  {tweaking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                También podés editar el mensaje a mano arriba antes de copiarlo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
