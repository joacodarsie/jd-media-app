"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Paperclip,
  Mic,
  MicOff,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

type AttachmentKind = "image" | "pdf" | "csv";

interface Attachment {
  kind: AttachmentKind;
  name: string;
  mediaType: string;
  /** base64 sin el prefijo data: para image/pdf; texto plano para csv */
  data: string;
  size: number;
}

interface ContentText {
  type: "text";
  text: string;
}
interface ContentImage {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}
interface ContentDocument {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
}
type ContentBlock = ContentText | ContentImage | ContentDocument;

interface ChatMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
  /** Para render: nombres de archivos adjuntos no-imagen (PDF, CSV ya inline). */
  attachmentLabels?: { name: string; kind: AttachmentKind }[];
}

// Límites pensados para no pasar el body-size cap de Vercel (~4.5MB).
const MAX_IMG_MB = 3;
const MAX_PDF_MB = 4;
const MAX_CSV_MB = 1;

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      // result viene como "data:<mime>;base64,<...>"
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function renderUserText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is ContentText => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function renderUserImages(blocks: ContentBlock[]): { src: string; mt: string }[] {
  return blocks
    .filter((b): b is ContentImage => b.type === "image")
    .map((b) => ({
      src: `data:${b.source.media_type};base64,${b.source.data}`,
      mt: b.source.media_type,
    }));
}

export function AIChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, attachments.length]);

  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return; // dejar que pegue texto normal
    e.preventDefault();
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    await pickFiles(dt.files);
  }

  async function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      const mt = file.type || "";
      if (ALLOWED_IMAGE.includes(mt)) {
        if (file.size > MAX_IMG_MB * 1024 * 1024) {
          toast.error(`${file.name}: imagen >${MAX_IMG_MB}MB`);
          continue;
        }
        next.push({
          kind: "image",
          name: file.name,
          mediaType: mt,
          data: await fileToBase64(file),
          size: file.size,
        });
      } else if (mt === "application/pdf" || /\.pdf$/i.test(file.name)) {
        if (file.size > MAX_PDF_MB * 1024 * 1024) {
          toast.error(`${file.name}: PDF >${MAX_PDF_MB}MB`);
          continue;
        }
        next.push({
          kind: "pdf",
          name: file.name,
          mediaType: "application/pdf",
          data: await fileToBase64(file),
          size: file.size,
        });
      } else if (
        mt === "text/csv" ||
        /\.csv$/i.test(file.name) ||
        mt === "text/plain"
      ) {
        if (file.size > MAX_CSV_MB * 1024 * 1024) {
          toast.error(`${file.name}: CSV >${MAX_CSV_MB}MB`);
          continue;
        }
        const text = await fileToText(file);
        next.push({
          kind: "csv",
          name: file.name,
          mediaType: "text/csv",
          data: text.slice(0, 200_000),
          size: file.size,
        });
      } else {
        toast.error(`${file.name}: tipo no soportado`);
      }
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((a) => a.filter((_, i) => i !== idx));
  }

  function buildUserBlocks(text: string, atts: Attachment[]): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    for (const a of atts) {
      if (a.kind === "image") {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: a.mediaType, data: a.data },
        });
      } else if (a.kind === "pdf") {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: a.data,
          },
        });
      } else if (a.kind === "csv") {
        blocks.push({
          type: "text",
          text: `Archivo CSV adjunto (${a.name}):\n\`\`\`csv\n${a.data}\n\`\`\``,
        });
      }
    }
    if (text.trim()) blocks.push({ type: "text", text });
    if (blocks.length === 0) blocks.push({ type: "text", text: "(sin contenido)" });
    return blocks;
  }

  function toggleDictation() {
    if (recording) {
      recogRef.current?.stop();
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error(
        "Tu navegador no soporta dictado por voz. Usá Chrome o Edge."
      );
      return;
    }
    const r = new Ctor();
    r.lang = "es-AR";
    r.continuous = true;
    r.interimResults = true;
    let baseline = input;
    r.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText) {
        baseline = (baseline ? baseline + " " : "") + finalText.trim();
        setInput(baseline);
      } else {
        setInput((baseline ? baseline + " " : "") + interim);
      }
    };
    r.onend = () => {
      setRecording(false);
      recogRef.current = null;
    };
    r.onerror = () => {
      setRecording(false);
      recogRef.current = null;
    };
    recogRef.current = r;
    setRecording(true);
    r.start();
  }

  async function send() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || sending) return;

    const userBlocks = buildUserBlocks(text, attachments);
    const userMsg: ChatMessage = {
      role: "user",
      content: userBlocks,
      attachmentLabels: attachments
        .filter((a) => a.kind !== "image")
        .map((a) => ({ name: a.name, kind: a.kind })),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error en el chat");
      } else {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: [
              { type: "text", text: data.reply || "(sin respuesta)" },
            ],
          },
        ]);
        router.refresh();
      }
    } catch {
      toast.error("No se pudo conectar con el asistente.");
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          open && "hidden"
        )}
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-3 sm:p-5">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-[85vh] w-full max-w-md flex-col rounded-xl border bg-card shadow-2xl sm:h-[640px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Asistente JD</div>
                <div className="text-xs text-muted-foreground">
                  Tareas, clientes, procesos · acepta imágenes, PDFs, CSV, voz y links
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
              {messages.length === 0 && (
                <div className="space-y-2 text-muted-foreground">
                  <p>Probá pedirme algo como:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• {`«¿Qué tareas vencen esta semana?»`}</li>
                    <li>• {`«Mirá esta referencia [adjuntás imagen]: copy para post de @cliente»`}</li>
                    <li>• {`«Leéme este PDF y resumime los puntos clave»`}</li>
                    <li>• 🎤 Tocá el micrófono y hablá: convierto tu voz a texto.</li>
                    <li>• {`Pegá un link (web/notion) y lo leo automáticamente.`}</li>
                  </ul>
                </div>
              )}
              {messages.map((m, i) => {
                const text = renderUserText(m.content);
                const imgs = m.role === "user" ? renderUserImages(m.content) : [];
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2",
                      m.role === "user" ? "ml-6 bg-primary/10" : "mr-6 bg-muted/50"
                    )}
                  >
                    {imgs.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {imgs.map((im, k) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={k}
                            src={im.src}
                            alt="adjunto"
                            className="max-h-40 rounded-md border"
                          />
                        ))}
                      </div>
                    )}
                    {m.attachmentLabels && m.attachmentLabels.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {m.attachmentLabels.map((a, k) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {a.kind === "pdf" ? (
                              <FileText className="h-3 w-3" />
                            ) : (
                              <FileSpreadsheet className="h-3 w-3" />
                            )}
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      <Markdown>{text}</Markdown>
                    ) : (
                      text && <p className="whitespace-pre-wrap">{text}</p>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {attachments.length > 0 && (
              <div className="border-t bg-muted/30 px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <span
                      key={i}
                      className="group inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {a.kind === "image" ? (
                        <ImageIcon className="h-3 w-3" />
                      ) : a.kind === "pdf" ? (
                        <FileText className="h-3 w-3" />
                      ) : (
                        <FileSpreadsheet className="h-3 w-3" />
                      )}
                      <span className="max-w-[140px] truncate">{a.name}</span>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        aria-label="Quitar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t p-3">
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.csv,text/csv,text/plain"
                  multiple
                  className="hidden"
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Adjuntar imagen, PDF o CSV"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={recording ? "default" : "ghost"}
                  size="icon"
                  title={recording ? "Detener dictado" : "Dictar por voz"}
                  onClick={toggleDictation}
                  disabled={sending}
                  className={cn(recording && "animate-pulse")}
                >
                  {recording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  onPaste={onPaste}
                  disabled={sending}
                  placeholder={
                    recording
                      ? "Hablá… (escuchando)"
                      : "Escribí, dictá o adjuntá archivos…"
                  }
                  className="flex-1 resize-none rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  onClick={send}
                  disabled={sending || (!input.trim() && attachments.length === 0)}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Enter envía · Shift+Enter salto · 🎤 dicta · 📎 o Ctrl+V para
                imagen / PDF / CSV · pegá links y los leo
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Tipos mínimos para SpeechRecognition (no están en lib.dom estándar)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [k: number]: { transcript: string };
  }> & { length: number };
}
