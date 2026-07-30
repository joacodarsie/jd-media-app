"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, Pencil, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  guardarMensajeRecordatorio,
  restaurarMensajeRecordatorio,
  ocultarRecordatorio,
  marcarGrupoCobrado,
} from "@/app/(app)/finanzas/reminder-actions";

export interface ReminderCardData {
  id: string;
  nombre: string;
  pack: string | null;
  montoLabel: string;
  sinMonto: boolean;
  mensaje: string;
  waLink: string | null;
  telefono: string | null;
  /** Ids de las cuentas del grupo (para marcar las facturas cobradas). */
  clienteIds: string[];
  /** true si el texto que llega fue editado a mano y guardado. */
  editado?: boolean;
  oculto?: boolean;
}

export function PaymentReminderCard({
  data,
  periodo,
}: {
  data: ReminderCardData;
  periodo: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(data.mensaje);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /** Al cerrar la edición se guarda: si no, el cambio se pierde al recargar. */
  function toggleEdit() {
    if (!editing) {
      setEditing(true);
      return;
    }
    setEditing(false);
    if (text === data.mensaje) return;
    start(async () => {
      const res = await guardarMensajeRecordatorio({
        periodo,
        grupoKey: data.id,
        mensaje: text,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Mensaje guardado");
      router.refresh();
    });
  }

  function restaurar() {
    start(async () => {
      const res = await restaurarMensajeRecordatorio(periodo, data.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Volvió al mensaje automático");
      router.refresh();
    });
  }

  function sacar(oculto: boolean) {
    start(async () => {
      const res = await ocultarRecordatorio({ periodo, grupoKey: data.id, oculto });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        oculto
          ? `${data.nombre} sale de la lista de este mes`
          : `${data.nombre} vuelve a la lista`
      );
      router.refresh();
    });
  }

  function yaCobre() {
    start(async () => {
      const res = await marcarGrupoCobrado({
        periodo,
        grupoKey: data.id,
        clienteIds: data.clienteIds,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcado como cobrado ✅");
      router.refresh();
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
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              {data.nombre}
              {data.editado && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  editado
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.pack ?? "Sin pack"} ·{" "}
              <span className={cn(data.sinMonto && "font-medium text-amber-600")}>
                {data.montoLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {data.editado && !editing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={restaurar}
                disabled={pending}
                title="Volver al mensaje automático"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={toggleEdit}
              disabled={pending}
            >
              <Pencil className="h-3 w-3" /> {editing ? "Listo" : "Editar"}
            </Button>
            {data.oculto ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => sacar(false)}
                disabled={pending}
              >
                <RotateCcw className="h-3 w-3" /> Volver a la lista
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => sacar(true)}
                disabled={pending}
                title="No hay que mandarle este mes: lo saca de la lista"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-8 gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            onClick={yaCobre}
            disabled={pending}
            title="Marca las facturas del mes como cobradas y lo saca de la lista"
          >
            <Check className="h-3.5 w-3.5" /> Ya cobré
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
