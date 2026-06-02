"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ReminderCardData {
  id: string;
  nombre: string;
  pack: string | null;
  montoLabel: string;
  sinMonto: boolean;
  mensaje: string;
  waLink: string | null;
  telefono: string | null;
}

export function PaymentReminderCard({ data }: { data: ReminderCardData }) {
  const [text, setText] = useState(data.mensaje);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // El link de WhatsApp se arma con el texto vivo (por si lo editaste).
  const waLink = data.telefono
    ? `https://wa.me/${data.telefono}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <Card className={cn(data.sinMonto && "border-amber-300")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">{data.nombre}</div>
            <div className="text-xs text-muted-foreground">
              {data.pack ?? "Sin pack"} ·{" "}
              <span className={cn(data.sinMonto && "font-medium text-amber-600")}>
                {data.montoLabel}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setEditing((e) => !e)}
          >
            <Pencil className="h-3 w-3" /> {editing ? "Listo" : "Editar"}
          </Button>
        </div>

        {editing ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            className="text-sm"
          />
        ) : (
          <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
            {text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {waLink ? (
            <Button asChild size="sm" className="h-8 gap-1 bg-[#25D366] text-white hover:bg-[#1ebe5b]">
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
      </CardContent>
    </Card>
  );
}
