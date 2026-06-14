"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  Copy as CopyIcon,
  Check,
  Mic,
  Square,
  ImagePlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

type Mode = "pdf" | "text";

// ── Web Speech API (dictado por voz) ──
interface SRAlt { transcript: string }
interface SRRes { isFinal: boolean; 0: SRAlt }
interface SRList { length: number; [i: number]: SRRes }
interface SREvent { resultIndex: number; results: SRList }
interface SRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}
type SRCtor = new () => SRecognition;
function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface AttachedImage {
  id: string;
  file: File;
  url: string;
}

export function MeetGuideGenerator({
  clienteId,
  initialMarkdown,
  initialGeneratedAt,
}: {
  clienteId: string;
  initialMarkdown: string | null;
  initialGeneratedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [liveMarkdown, setLiveMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  // El documento queda colapsado por defecto (solo se usa para el meet).
  const [showGuide, setShowGuide] = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [dictating, setDictating] = useState(false);
  const [srSupported, setSrSupported] = useState(false);
  const recognitionRef = useRef<SRecognition | null>(null);
  const dictatingRef = useRef(false);

  useEffect(() => {
    setSrSupported(!!getSR());
    return () => {
      dictatingRef.current = false;
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  function startDictation() {
    const SR = getSR();
    if (!SR) { toast.error("Tu navegador no soporta dictado. Probá con Chrome."); return; }
    const rec = new SR();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      if (chunk.trim()) {
        setInstructions((prev) => (prev ? prev.replace(/\s*$/, "") + " " : "") + chunk.trim());
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        toast.error("Permití el micrófono para dictar.");
        dictatingRef.current = false;
        setDictating(false);
      }
    };
    rec.onend = () => {
      if (dictatingRef.current) { try { rec.start(); } catch {} }
      else setDictating(false);
    };
    recognitionRef.current = rec;
    dictatingRef.current = true;
    setDictating(true);
    try { rec.start(); } catch {}
  }
  function stopDictation() {
    dictatingRef.current = false;
    setDictating(false);
    try { recognitionRef.current?.stop(); } catch {}
  }
  function toggleDictation() {
    if (dictating) stopDictation();
    else startDictation();
  }

  function addImages(files: FileList | null) {
    const arr = Array.from(files ?? []);
    for (const f of arr) {
      if (!f.type.startsWith("image/")) { toast.error("Solo imágenes."); continue; }
      if (f.size > 8 * 1024 * 1024) { toast.error("Imagen muy grande (máx 8 MB)."); continue; }
      setImages((prev) =>
        prev.length >= 5
          ? (toast.error("Máximo 5 imágenes"), prev)
          : [...prev, { id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) }]
      );
    }
  }
  function removeImage(id: string) {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  const markdown = liveMarkdown || initialMarkdown || "";
  const hasGuide = !!markdown;
  // Hay con qué generar si tenemos PDF, texto, notas o capturas.
  const hasInput =
    (mode === "pdf" && !!file) ||
    text.trim().length > 0 ||
    instructions.trim().length > 0 ||
    images.length > 0;

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tiene que ser un PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("El PDF supera los 20 MB.");
      return;
    }
    setFile(f);
  }

  function fmtBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  async function generate() {
    if (!hasInput) {
      toast.error("Cargá algo: PDF, transcripción, notas o una captura.");
      return;
    }

    setGenerating(true);
    setLiveMarkdown("");

    const form = new FormData();
    form.set("cliente_id", clienteId);
    if (mode === "pdf" && file) form.set("file", file);
    if (text.trim()) form.set("transcript", text);
    if (instructions.trim()) form.set("instructions", instructions);
    for (const img of images) form.append("image", img.file);

    try {
      const res = await fetch("/api/onboarding/generate-guide", {
        method: "POST",
        body: form,
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let errMsg: string | null = null;
      let done = false;

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
              if (evt.type === "chunk" && typeof evt.text === "string") {
                acc += evt.text;
                setLiveMarkdown(acc);
              } else if (evt.type === "done") {
                done = true;
              } else if (evt.type === "error") {
                errMsg = (evt.error as string) ?? "Error";
              }
            } catch {
              /* */
            }
          }
        }
      }

      if (errMsg) throw new Error(errMsg);
      if (done) {
        toast.success("Guía generada y guardada.");
        // Hard reload por la misma razón que en diagnostic-workspace:
        // así la guía persistida se carga desde la nueva fetch del server.
        window.location.reload();
      } else {
        throw new Error("Generación terminó sin resultado.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("No se pudo copiar.")
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-medium">Guía personalizada del meet de onboarding</div>
            <div className="text-xs text-muted-foreground">
              {hasGuide
                ? `Generada ${
                    initialGeneratedAt
                      ? new Date(initialGeneratedAt).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "ahora"
                  }`
                : "Generá una guía adaptada a este cliente a partir de la transcripción del meet comercial."}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {hasGuide && (
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <CopyIcon className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          )}
          {hasGuide && !generating && (
            <Button variant="ghost" size="sm" onClick={() => setShowGuide((s) => !s)}>
              {showGuide ? (
                <>
                  <ChevronUp className="mr-1 h-3.5 w-3.5" /> Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" /> Ver documento
                </>
              )}
            </Button>
          )}
          <Button
            variant={hasGuide ? "outline" : "default"}
            size="sm"
            onClick={() => setOpen((o) => !o)}
          >
            {hasGuide ? (
              <>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> {open ? "Cancelar" : "Regenerar"}
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-3.5 w-3.5" /> {open ? "Cancelar" : "Generar guía"}
              </>
            )}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("pdf")}
              className={`rounded px-2 py-1 transition ${
                mode === "pdf"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              📄 Subir PDF del meet
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded px-2 py-1 transition ${
                mode === "text"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              ✏️ Pegar transcripción
            </button>
          </div>

          {mode === "pdf" ? (
            !file ? (
              <label
                htmlFor="meet-guide-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 bg-muted/20 hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                <Upload className="h-6 w-6 text-primary" />
                <div className="text-sm font-medium">
                  Arrastrá el PDF del meet comercial o <span className="text-primary underline">clic para elegir</span>
                </div>
                <div className="text-xs text-muted-foreground">PDF de Tactiq · hasta 20 MB</div>
                <input
                  id="meet-guide-file"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtBytes(file.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Pegá la transcripción del meet comercial. (Si no hubo meet formal, dejalo vacío y usá las notas de abajo.)"
            />
          )}

          {/* Notas / bases manuales + capturas (para cuando no hubo meet formal) */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium">
                Notas / bases del cliente <span className="text-muted-foreground">(opcional)</span>
              </div>
              <div className="flex items-center gap-3">
                {srSupported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] hover:underline",
                      dictating ? "font-medium text-red-600" : "text-primary"
                    )}
                  >
                    {dictating ? (
                      <>
                        <span className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
                          <Square className="h-2.5 w-2.5 fill-current" />
                        </span>
                        Detener
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" /> Grabar
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ImagePlus className="h-3 w-3" /> Captura
                </button>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addImages(e.target.files); if (imgInputRef.current) imgInputRef.current.value = ""; }}
                />
              </div>
            </div>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Info que tengas a mano: qué hace el negocio, lo que se habló por llamada/persona, links (ej. su Instagram o web), objetivos, lo que quieras que la IA tenga en cuenta…"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((im) => (
                  <div key={im.id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-16 w-16 rounded-md border object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(im.id)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                      title="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Tip: si pegás un link de Instagram o adjuntás una captura del perfil, la IA lo
              analiza para armar mejor la guía.
            </p>
          </div>

          <Button
            onClick={generate}
            disabled={generating || !hasInput}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" /> Generar guía
              </>
            )}
          </Button>
        </div>
      )}

      {(generating || (hasGuide && showGuide)) && (
        <div className="border-t px-4 py-4">
          {generating && !liveMarkdown && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Esperando que la IA arranque…
            </div>
          )}
          {(liveMarkdown || markdown) && (
            <Markdown>{liveMarkdown || markdown}</Markdown>
          )}
        </div>
      )}
    </div>
  );
}
