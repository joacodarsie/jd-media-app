"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquareText,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Pencil,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  regenerateCampaignMessages,
  saveCampaignMessages,
} from "@/app/(app)/prospeccion/actions";
import {
  MENSAJE_BLOQUES,
  mensajeElegido,
  type CampaignMessages,
  type MensajeBloqueKey,
} from "@/lib/prospecting/shared";

export type { CampaignMessages };

export function ProspectingCampaignMessages({
  campaignId,
  initial,
  canGenerate,
  autoGenerate = false,
}: {
  campaignId: string;
  initial: CampaignMessages | null;
  /** Solo el director genera/regenera (consume tokens). Editar puede cualquiera. */
  canGenerate: boolean;
  /** Auto-generar al entrar (solo tras CREAR la campaña, para no gastar de más). */
  autoGenerate?: boolean;
}) {
  const [messages, setMessages] = useState<CampaignMessages | null>(initial);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState<MensajeBloqueKey | null>(null);
  const autoTried = useRef(false);

  const elegido = mensajeElegido(messages);

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

  /** Guarda el texto editado de un bloque. */
  async function guardarTexto(key: MensajeBloqueKey, texto: string) {
    setGuardando(key);
    const res = await saveCampaignMessages(campaignId, { mensajes: { [key]: texto } });
    setGuardando(null);
    if ("error" in res) {
      toast.error(res.error);
      return false;
    }
    setMessages(res.messages);
    toast.success("Mensaje guardado");
    return true;
  }

  /** Marca cuál se usa para escribirle a los contactos. */
  async function elegir(key: MensajeBloqueKey) {
    setGuardando(key);
    const res = await saveCampaignMessages(campaignId, { elegido: key });
    setGuardando(null);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setMessages(res.messages);
    toast.success("Listo: es el que se va a usar en Contactos.");
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
          <Button
            variant="outline"
            size="sm"
            onClick={generar}
            disabled={loading}
            title={
              messages
                ? "Vuelve a escribirlos con IA. Se pierden las ediciones a mano (la elección se mantiene)."
                : undefined
            }
          >
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
        Editalos a gusto y marcá con la ⭐ el que querés usar: ese es el que sale
        en <b>Contactos</b> al copiar, al abrir WhatsApp y en el modo despacho.
        Los huecos <code>[EMPRESA]</code> y <code>[NOMBRE]</code> se completan
        solos con los datos de cada contacto.
      </p>

      {loading && !messages ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Armando los mensajes ideales…
        </div>
      ) : messages ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {MENSAJE_BLOQUES.map(({ key, label }) => (
            <MessageBlock
              key={key}
              label={label}
              text={messages[key] ?? ""}
              enUso={elegido?.key === key}
              guardando={guardando === key}
              onSave={(t) => guardarTexto(key, t)}
              onElegir={() => elegir(key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBlock({
  label,
  text,
  enUso,
  guardando,
  onSave,
  onElegir,
}: {
  label: string;
  text: string;
  enUso: boolean;
  guardando: boolean;
  onSave: (texto: string) => Promise<boolean>;
  onElegir: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(text);

  // Si el texto cambia desde afuera (regenerar), refrescamos el borrador.
  useEffect(() => {
    if (!editando) setBorrador(text);
  }, [text, editando]);

  if (!text && !editando) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  async function guardar() {
    const ok = await onSave(borrador);
    if (ok) setEditando(false);
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3 transition",
        enUso && "border-primary ring-1 ring-primary/30"
      )}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {label}
          {enUso && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-foreground">
              <Star className="h-2.5 w-2.5 fill-current" /> En uso en Contactos
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {!enUso && !editando && (
            <button
              onClick={onElegir}
              disabled={guardando}
              title="Usar este mensaje para escribirle a los contactos"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
            >
              {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
              Usar este
            </button>
          )}
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {!editando && (
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
          )}
        </div>
      </div>

      {editando ? (
        <div className="space-y-2">
          <Textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={9}
            className="text-sm leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBorrador(text);
                setEditando(false);
              }}
              disabled={guardando}
              className="h-7 gap-1 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={guardar}
              disabled={guardando || !borrador.trim()}
              className="h-7 gap-1 text-xs"
            >
              {guardando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      )}
    </div>
  );
}
