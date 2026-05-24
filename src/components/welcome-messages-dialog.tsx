"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildWelcomeMessages, toggleOnboardingStep } from "@/app/(app)/clientes/[id]/onboarding/actions";

export function WelcomeMessagesDialog({
  clientId,
  alreadyDone,
}: {
  clientId: string;
  alreadyDone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();

  async function load() {
    setLoading(true);
    const res = await buildWelcomeMessages(clientId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMessages(res.messages);
  }

  async function copyMessage(idx: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  async function copyAll() {
    if (!messages) return;
    try {
      await navigator.clipboard.writeText(messages.join("\n\n———\n\n"));
      toast.success("Todos los mensajes copiados.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function markSent() {
    start(async () => {
      const res = await toggleOnboardingStep(clientId, "mensajes_enviados_at", true);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcado como enviado.");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !messages) load();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageSquare className="mr-1 h-4 w-4" />
          {alreadyDone ? "Ver mensajes" : "Generar mensajes"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadena de mensajes de bienvenida</DialogTitle>
        </DialogHeader>
        {loading || !messages ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Armando mensajes según los
            servicios contratados…
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Adaptados a los servicios del cliente. Copialos y pegalos en orden en el grupo de WhatsApp.
            </p>
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={copyAll}>
                <Copy className="mr-1 h-4 w-4" /> Copiar todos
              </Button>
              <Button size="sm" onClick={markSent} disabled={pending}>
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Marcar como enviados
              </Button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className="rounded-md border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Mensaje {i + 1}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyMessage(i, m)}
                      className="h-7 px-2"
                    >
                      {copiedIdx === i ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {m}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
