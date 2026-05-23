"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

interface InitialMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "¿Qué tareas vencen esta semana?",
  "Resumime cómo viene el mes en finanzas",
  "Escribime un copy para Boxes Car (Instagram)",
  "¿Qué clientes no tienen pubs programadas en los próximos 7 días?",
];

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
    initialMessages.map((m) => ({ role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setMessages((curr) => [
      ...curr,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);

    let newConvId: string | null = null;
    let gotError = false;

    try {
      const res = await fetch("/api/jdmedia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text: content }),
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

        // Procesar eventos SSE separados por \n\n
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
              Acceso a tareas, clientes, contenidos, equipo, finanzas y procesos
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
                Soy JDmedIA. Probá pedirme algo concreto o tocá una sugerencia.
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
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
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
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribí tu mensaje… (Enter para enviar, Shift+Enter salto de línea)"
            rows={1}
            disabled={sending}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-md border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
