"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, Mic, Square, Sparkles, Activity, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ── Web Speech API (dictado) ──
interface SRAlt { transcript: string }
interface SRRes { isFinal: boolean; 0: SRAlt }
interface SRList { length: number; [i: number]: SRRes }
interface SREvent { resultIndex: number; results: SRList }
interface SRecognition {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
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

export function PaidMediaChat({ clienteId }: { clienteId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [srSupported, setSrSupported] = useState(false);
  const recognitionRef = useRef<SRecognition | null>(null);
  const dictatingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSrSupported(!!getSR());
    return () => {
      dictatingRef.current = false;
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
      if (chunk.trim()) setInput((prev) => (prev ? prev.replace(/\s*$/, "") + " " : "") + chunk.trim());
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

  async function send(text: string, deep = false) {
    const content = text.trim();
    if (!content || loading) return;
    if (dictating) stopDictation();
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/paid-media/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, messages: next, deep }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || `Error ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: json.reply ?? "(sin respuesta)" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
      // revertir el mensaje del usuario para que pueda reintentar
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  const quick = [
    { label: "Análisis profundo", icon: Sparkles, text: "Hacé un análisis profundo de la cuenta: revisá campañas y conjuntos, decime qué rinde, qué se está yendo de costo, y dame recomendaciones concretas y priorizadas para mejorar.", deep: true },
    { label: "¿Cómo vengo?", icon: Activity, text: "¿Cómo viene la cuenta? Dame un resumen corto y claro de lo importante.", deep: false },
  ];

  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col rounded-xl border bg-card">
      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Bot className="mb-2 h-8 w-8 text-primary/60" />
            <p className="max-w-sm">
              Preguntale lo que quieras sobre la pauta de este cliente: cómo viene, qué optimizar,
              cómo lograr un objetivo. Tiene las métricas de la cuenta y el contexto del negocio.
            </p>
            <p className="mt-1 text-xs">Podés escribir o dictar con el micrófono 🎤</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-muted/40"
              )}
            >
              {m.role === "assistant" ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
            </div>
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2 border-t px-3 pt-3">
        {quick.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              type="button"
              disabled={loading}
              onClick={() => send(q.text, q.deep)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-primary" /> {q.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3">
        {srSupported && (
          <Button
            type="button"
            variant={dictating ? "default" : "outline"}
            size="icon"
            onClick={() => (dictating ? stopDictation() : startDictation())}
            title={dictating ? "Detener dictado" : "Dictar"}
            className="shrink-0"
          >
            {dictating ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Escribí o dictá tu pregunta sobre la pauta…"
          className="max-h-32 min-h-[40px] flex-1 resize-none"
        />
        <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
