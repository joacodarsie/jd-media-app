"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { useDictation } from "@/hooks/use-dictation";

export interface ChatAttachment {
  name: string;
  mime_type: string;
  url: string;
  size?: number;
}

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
}

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

interface PendingFile {
  file: File;
  kind: "image" | "pdf" | "text" | "other";
  previewUrl?: string;
}

const SUGGESTIONS = [
  "¿Qué tareas vencen esta semana?",
  "Resumime cómo viene el mes en finanzas",
  "Escribime un copy para Boxes Car (Instagram)",
  "¿Qué clientes no tienen pubs programadas en los próximos 7 días?",
];

const MAX_IMG_MB = 3;
const MAX_PDF_MB = 4;
const MAX_TEXT_MB = 1;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function classifyFile(file: File): PendingFile["kind"] {
  if (ALLOWED_IMAGE.includes(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.name.endsWith(".csv")
  )
    return "text";
  return "other";
}

function maxMbFor(kind: PendingFile["kind"]) {
  if (kind === "image") return MAX_IMG_MB;
  if (kind === "pdf") return MAX_PDF_MB;
  if (kind === "text") return MAX_TEXT_MB;
  return 1;
}

export function JdmediaChat({
  conversationId: initialConversationId,
  initialMessages,
  userName,
}: {
  conversationId: string | null;
  initialMessages: InitialMessage[];
  userName: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [messages, setMessages] = useState<UiMessage[]>(
    initialMessages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
    }))
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { recording, toggle: toggleDictation } = useDictation({
    initialText: () => input,
    onText: setInput,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const accepted: PendingFile[] = [];
    for (const f of arr) {
      const kind = classifyFile(f);
      if (kind === "other") {
        toast.error(`${f.name}: tipo no soportado`);
        continue;
      }
      const max = maxMbFor(kind);
      if (f.size > max * 1024 * 1024) {
        toast.error(`${f.name}: supera ${max}MB`);
        continue;
      }
      accepted.push({
        file: f,
        kind,
        previewUrl: kind === "image" ? URL.createObjectURL(f) : undefined,
      });
    }
    if (accepted.length > 0) setPending((curr) => [...curr, ...accepted]);
  }

  function removePending(idx: number) {
    setPending((curr) => {
      const copy = curr.slice();
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  }

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
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  async function uploadPending(): Promise<
    {
      storage_path: string;
      name: string;
      mime_type: string;
      size: number;
    }[]
  > {
    if (pending.length === 0) return [];
    const supabase = createClient();
    const out: {
      storage_path: string;
      name: string;
      mime_type: string;
      size: number;
    }[] = [];
    for (const p of pending) {
      const ext = p.file.name.split(".").pop() ?? "bin";
      const path = `jdmedia/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(path, p.file, {
          contentType: p.file.type || "application/octet-stream",
        });
      if (error) {
        toast.error(`Subiendo ${p.file.name}: ${error.message}`);
        continue;
      }
      out.push({
        storage_path: path,
        name: p.file.name,
        mime_type: p.file.type || "application/octet-stream",
        size: p.file.size,
      });
    }
    return out;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && pending.length === 0) || sending) return;

    setSending(true);

    // Optimistic render
    const optimisticAtts: ChatAttachment[] = pending.map((p) => ({
      name: p.file.name,
      mime_type: p.file.type,
      url: p.previewUrl ?? "",
      size: p.file.size,
    }));
    setMessages((curr) => [
      ...curr,
      { role: "user", content, attachments: optimisticAtts },
      { role: "assistant", content: "" },
    ]);

    let uploaded: Awaited<ReturnType<typeof uploadPending>> = [];
    try {
      uploaded = await uploadPending();
    } catch (e) {
      toast.error("Falló subir adjuntos: " + (e instanceof Error ? e.message : ""));
      setMessages((curr) => curr.slice(0, -2));
      setSending(false);
      return;
    }

    setInput("");
    setPending([]);

    let newConvId: string | null = null;
    let gotError = false;

    try {
      const res = await fetch("/api/jdmedia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text: content,
          attachments: uploaded,
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Error inesperado");
        toast.error(errText || "Error inesperado");
        setMessages((curr) => curr.slice(0, -2));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const line = rawEvent.startsWith("data: ")
            ? rawEvent.slice(6)
            : rawEvent;
          if (!line.trim()) continue;
          let ev: {
            type: string;
            text?: string;
            conversationId?: string;
            message?: string;
          };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }

          if (ev.type === "meta" && ev.conversationId) {
            newConvId = ev.conversationId;
          } else if (ev.type === "delta" && ev.text) {
            setMessages((curr) => {
              const copy = curr.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: last.content + ev.text!,
                };
              }
              return copy;
            });
          } else if (ev.type === "error") {
            gotError = true;
            toast.error(ev.message || "Error del servidor");
            setMessages((curr) => curr.slice(0, -2));
          }
        }
      }
    } catch (e) {
      gotError = true;
      toast.error("No se pudo enviar: " + (e instanceof Error ? e.message : ""));
      setMessages((curr) => curr.slice(0, -2));
    } finally {
      setSending(false);
      textareaRef.current?.focus();

      if (!gotError && newConvId) {
        if (!conversationId) {
          setConversationId(newConvId);
          router.replace(`/jdmedia?c=${newConvId}`);
        }
        router.refresh();
      }
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground md:hidden">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">JDmedIA</div>
            <div className="text-[11px] text-muted-foreground">
              Acepta imágenes, PDFs y texto. Las conversaciones se guardan.
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
            <div>
              <h2 className="text-2xl font-bold">Hola {userName.split(" ")[0]} 👋</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Soy JDmedIA. Probá pedirme algo o tocá una sugerencia.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border bg-card px-3 py-3 text-left text-sm hover:border-primary/40 hover:bg-muted/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((m, i) => {
              const last = i === messages.length - 1;
              const emptyAssistant =
                m.role === "assistant" && !m.content && last && sending;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {m.attachments && m.attachments.length > 0 && (
                      <MessageAttachments items={m.attachments} />
                    )}
                    {emptyAssistant ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Pensando…
                      </div>
                    ) : m.role === "assistant" ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pending.map((p, idx) => (
                <PendingChip
                  key={idx}
                  pending={p}
                  onRemove={() => removePending(idx)}
                />
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,text/plain,text/csv,application/json,.csv,.txt,.json"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Adjuntar imagen, PDF o texto"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={recording ? "default" : "outline"}
              size="icon"
              className={cn("h-11 w-11 shrink-0", recording && "animate-pulse")}
              onClick={toggleDictation}
              disabled={sending}
              title={recording ? "Detener dictado" : "Dictar por voz"}
            >
              {recording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              onPaste={onPaste}
              placeholder={
                recording
                  ? "Hablá… (escuchando)"
                  : "Escribí tu mensaje… (Enter para enviar)"
              }
              rows={1}
              disabled={sending}
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-md border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button
              onClick={() => send()}
              disabled={sending || (!input.trim() && pending.length === 0)}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingChip({
  pending,
  onRemove,
}: {
  pending: PendingFile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
      {pending.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pending.previewUrl}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      ) : pending.kind === "pdf" ? (
        <FileText className="h-4 w-4 text-red-500" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="max-w-[140px] truncate">{pending.file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label="Quitar adjunto"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MessageAttachments({ items }: { items: ChatAttachment[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a, i) => {
        const isImage = a.mime_type.startsWith("image/");
        if (isImage && a.url) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="max-h-40 rounded-md object-cover"
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1 text-xs hover:bg-background/60"
          >
            {a.mime_type === "application/pdf" ? (
              <FileText className="h-3.5 w-3.5 text-red-500" />
            ) : a.mime_type.startsWith("image/") ? (
              <ImageIcon className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="max-w-[180px] truncate">{a.name}</span>
          </a>
        );
      })}
    </div>
  );
}
