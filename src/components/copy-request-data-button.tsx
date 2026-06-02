"use client";

import { useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Mensaje fijo para pedirle al cliente los datos de la carta acuerdo. */
export const REQUEST_DATA_MESSAGE = `Para armar la carta acuerdo, necesito los siguientes datos:
- Nombre completo
- DNI o CUIT
- Domicilio legal (puede ser tu casa o el de tu empresa)
- Mail

Con eso preparo el acuerdo de los servicios y te lo envío.`;

/** Botón que copia al portapapeles el mensaje de pedido de datos para la carta acuerdo. */
export function CopyRequestDataButton() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(REQUEST_DATA_MESSAGE)
      .then(() => {
        setCopied(true);
        toast.success("Mensaje copiado");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("No se pudo copiar"));
  }

  return (
    <Button variant="outline" className="gap-1.5" onClick={copy} type="button">
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <ClipboardList className="h-4 w-4 text-primary" />
      )}
      <span className="hidden sm:inline">Pedir datos al cliente</span>
      <span className="sm:hidden">Pedir datos</span>
    </Button>
  );
}
