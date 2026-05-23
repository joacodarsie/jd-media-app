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
    setMessages((curr) => [...curr, { role: "user", content }]);

    try {
      const res = await fetch("/api/jdmedia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text: content,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        conversationId?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        toast.error(data.error || "Error inesperado");
        setMessages((curr) => curr.slice(0, -1));
        setSending(false);
        return;
      }
      setMessages((curr) => [
        ...curr,
        { role: "assistant", content: data.reply ?? "" },
      ]);

      // Si era una conversación nueva, actualizar URL y refrescar sidebar
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
        router.replace(`/jdmedia?c=${data.conversationId}`);
        router.refresh();
      } else {
        // Sólo refrescar la sidebar (no recargar mensajes)
        router.refresh();
      }
    } catch (e) {
      toast.error("No se pudo enviar: " + (e instanceof Error ? e.message : ""));
      setMessages((curr) => curr.slice(0, -1));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
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
            {messages.map((m, i) => (
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
                  {m.role === "assistant" ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Pensando…
                </div>
              </div>
            )}
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
