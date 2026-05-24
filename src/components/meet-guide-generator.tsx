"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";

type Mode = "pdf" | "text";

export function MeetGuideGenerator({
  clienteId,
  initialMarkdown,
  initialGeneratedAt,
}: {
  clienteId: string;
  initialMarkdown: string | null;
  initialGeneratedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [liveMarkdown, setLiveMarkdown] = useState("");
  const [copied, setCopied] = useState(false);

  const markdown = liveMarkdown || initialMarkdown || "";
  const hasGuide = !!markdown;

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
    if (mode === "pdf" && !file) {
      toast.error("Subí el PDF del meet comercial.");
      return;
    }
    if (mode === "text" && text.trim().length < 200) {
      toast.error("La transcripción es muy corta.");
      return;
    }

    setGenerating(true);
    setLiveMarkdown("");

    const form = new FormData();
    form.set("cliente_id", clienteId);
    if (mode === "pdf" && file) form.set("file", file);
    if (mode === "text") form.set("transcript", text);

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
              placeholder="Pegá acá la transcripción del meet comercial (mínimo 200 caracteres)."
            />
          )}

          <Button
            onClick={generate}
            disabled={generating || (mode === "pdf" ? !file : text.trim().length < 200)}
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

      {(generating || hasGuide) && (
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
