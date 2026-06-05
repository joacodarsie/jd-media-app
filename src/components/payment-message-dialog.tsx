"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildPaymentMessage,
  toggleOnboardingStep,
} from "@/app/(app)/clientes/[id]/onboarding/actions";

export function PaymentMessageDialog({
  clientId,
  alreadyDone,
}: {
  clientId: string;
  alreadyDone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function load() {
    setLoading(true);
    const res = await buildPaymentMessage(clientId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMessage(res.message);
  }

  async function copy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Mensaje copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function markSent() {
    start(async () => {
      const res = await toggleOnboardingStep(clientId, "carta_enviada_at", true);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Carta marcada como enviada.");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !message) load();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CreditCard className="mr-1 h-4 w-4" />
          {alreadyDone ? "Ver mensaje de cobro" : "Mensaje de cobro"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mensaje para enviar al cliente</DialogTitle>
        </DialogHeader>
        {loading || !message ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Armando mensaje…
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Mensaje listo para copiar y enviar por WhatsApp.
            </p>
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" /> Copiar mensaje
                  </>
                )}
              </Button>
              <Button size="sm" onClick={markSent} disabled={pending}>
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Marcar carta como enviada
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-card p-3">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {message}
              </pre>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: copiá esto, abrí el chat del cliente, pegá, y adjuntá el PDF de la carta acuerdo.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
