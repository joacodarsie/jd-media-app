"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateCampaignMessages } from "@/app/(app)/prospeccion/actions";

export interface CampaignMessages {
  primer_mensaje: string;
  alternativa: string;
  seguimiento_1: string;
  seguimiento_2: string;
}

const BLOQUES: { key: keyof CampaignMessages; label: string }[] = [
  { key: "primer_mensaje", label: "Primer mensaje" },
  { key: "alternativa", label: "Alternativa (otro ángulo)" },
  { key: "seguimiento_1", label: "Seguimiento 1" },
  { key: "seguimiento_2", label: "Seguimiento 2" },
];

export function ProspectingCampaignMessages({
  campaignId,
  initial,
  canGenerate,
  autoGenerate = false,
}: {
  campaignId: string;
  initial: CampaignMessages | null;
  /** Solo el director genera/regenera (consume tokens). */
  canGenerate: boolean;
  /** Auto-generar al entrar (solo tras CREAR la campaña, para no gastar de más). */
  autoGenerate?: boolean;
}) {
  const [messages, setMessages] = useState<CampaignMessages | null>(initial);
  const [loading, setLoading] = useState(false);
  const autoTried = useRef(false);

  async function generar() {
    setLoading(true);
    try {
      const res = await regenerateCampaignMessages(campaignId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setMessages(res.messages);
      if (res.saved === false)
        toast.info("Mensajes generados. Aplicá la migración 0132 para que queden guardados.");
    } catch {
      toast.error("Error al generar los mensajes.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-generar una vez, solo tras crear la campaña (autoGenerate) y si sos el
  // director y todavía no hay plantilla. En campañas ya creadas se usa el botón.
  useEffect(() => {
    if (autoGenerate && canGenerate && !messages && !autoTried.current) {
      autoTried.current = true;
      void generar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sin mensajes y no puede generar: no mostramos la tarjeta.
  if (!messages && !canGenerate) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquareText className="h-4 w-4 text-primary" /> Mensajes de la campaña
        </h2>
        {canGenerate && (
          <Button variant="outline" size="sm" onClick={generar} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {messages ? "Regenerar" : "Generar"}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Listos para enviar. Cambiá <code>[EMPRESA]</code> por el nombre del negocio
        y <code>[NOMBRE]</code> por el de la persona (si no la tenés, sacá el
        saludo con nombre). Los firma quien los genera.
      </p>

      {loading && !messages ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Armando los mensajes ideales…
        </div>
      ) : messages ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BLOQUES.map(({ key, label }) => (
            <MessageBlock key={key} label={label} text={messages[key]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" /> Copiado
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copiar
            </>
          )}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}
