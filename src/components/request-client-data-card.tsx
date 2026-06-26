"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, MessageSquareText } from "lucide-react";

/**
 * Paso 1 del cierre comercial: pedirle al cliente los datos que necesitamos para
 * armar la carta acuerdo. Mensaje listo para copiar y mandar por WhatsApp.
 */
const DEFAULT_MSG = `¡Hola! 😊 ¡Genial que avancemos! Para dejar todo en regla y armarte la carta acuerdo, ¿me pasás estos datos?

• Nombre o razón social
• DNI o CUIT
• Domicilio
• Email
• Teléfono de contacto

Con eso preparo todo y arrancamos 🙌`;

export function RequestClientDataCard({ message = DEFAULT_MSG }: { message?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(message).then(
      () => {
        setCopied(true);
        toast.success("Mensaje copiado");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("No se pudo copiar")
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Paso 1
            </span>
            <h3 className="font-semibold">Pedile los datos al cliente</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Copiá este mensaje y mandáselo. Cuando te pase los datos, tocá{" "}
            <b className="text-foreground">Nueva propuesta</b> (paso 2) y los cargás.
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-sm">
            {message}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar mensaje"}
          </button>
        </div>
      </div>
    </div>
  );
}
