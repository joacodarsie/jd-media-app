"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Mensaje listo para enviarle al cliente de una PROPUESTA: resumen de lo
 * contratado + datos para transferir. Editable, con copiar y abrir WhatsApp.
 * La carta acuerdo (PDF) se adjunta aparte desde su botón de imprimir.
 */
export function ProposalMessageCard({
  telefono,
  mensaje,
}: {
  telefono: string | null;
  mensaje: string;
}) {
  const [text, setText] = useState(mensaje);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const waLink = telefono
    ? `https://wa.me/${telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Mensaje para el cliente (carta + datos de transferencia)
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? "Listo" : "Editar"}
        </Button>
      </div>

      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="text-sm"
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
          {text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={copy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar mensaje"}
        </Button>
        {waLink ? (
          <Button
            asChild
            size="sm"
            className="h-8 gap-1 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
          >
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sin teléfono cargado · copiá y pegá el mensaje
          </span>
        )}
      </div>
    </div>
  );
}
