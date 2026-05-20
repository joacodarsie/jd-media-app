"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AIChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error en el chat");
        setMessages(next);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply || "(sin respuesta)" }]);
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
          <div className="relative flex h-[85vh] w-full max-w-md flex-col rounded-xl border bg-card shadow-2xl sm:h-[600px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Asistente JD</div>
                <div className="text-xs text-muted-foreground">
                  Crea tareas, consulta clientes, busca procesos
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
                    <li>• {`«Crea una tarea para Luz, urgente, vence viernes: revisar reel Boxescar»`}</li>
                    <li>• {`«¿Cómo es el proceso de onboarding cliente?»`}</li>
                    <li>• {`«Mostrame los datos de Dr Humberto»`}</li>
                  </ul>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-2",
                    m.role === "user"
                      ? "ml-6 bg-primary/10"
                      : "mr-6 bg-muted/50"
                  )}
                >
                  {m.role === "assistant" ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              ))}
              {sending && (
                <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3">
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={sending}
                  placeholder="Escribí tu pregunta o pedido…"
                  className="flex-1 resize-none rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button onClick={send} disabled={sending || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Enter para enviar · Shift+Enter para nueva línea
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
