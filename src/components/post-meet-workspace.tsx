"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUGERENCIAS = [
  "Reunión con Juan de ferretería tipo. Tienen IG pero suben poco. Buscan más clientes locales. Mencionó tener presupuesto entre 100k y 150k mensuales. Acordamos mandarle propuesta esta semana.",
  "Llamada con Marta. Tiene un emprendimiento de cosmética natural. No tiene marca fuerte, vende por WhatsApp. Quiere profesionalizar. No tiene urgencia, quiere arrancar el mes que viene. Pidió tiempo para pensarlo.",
];

export function PostMeetWorkspace() {
  const [clientName, setClientName] = useState("");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    try {
      const res = await fetch("/api/post-meet-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: text, clientName: clientName.trim() }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error generando mensaje");
        return;
      }
      setMessage(data.message ?? "");
    } catch (e) {
      toast.error("No se pudo generar: " + (e instanceof Error ? e.message : ""));
    } finally {
      setLoading(false);
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
    setMessage(null);
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
            <Label htmlFor="context" className="text-xs">
              Transcripción o resumen de la reunión
            </Label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={10}
              placeholder="Pegá la transcripción completa de la meet, o escribí un resumen con los puntos clave: qué hace el cliente, su dolor, sus objetivos, qué te pidió, próximos pasos…"
              className="min-h-[180px] w-full resize-y rounded-md border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cuanto más contexto, mejor el mensaje. La IA usa la voz de JD
              Media.
            </p>
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
            <div className="whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm leading-relaxed">
              {message}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si querés ajustar el tono o agregar/quitar algo, editá la
              transcripción y volvé a generar. O tocá el mensaje arriba para
              editarlo manualmente antes de pegarlo.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
