"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  regenerateWaSecret,
  setWaSecret,
  reenqueueFailed,
} from "@/app/(app)/accesos/wa-actions";

export interface WaQueueStats {
  pendiente: number;
  enviado: number;
  fallido: number;
  optinUsers: number;
}

export function WaConfigCard({
  hasSecret,
  stats,
  baseUrl,
}: {
  hasSecret: boolean;
  stats: WaQueueStats;
  baseUrl: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [newSecret, setNewSecret] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!newSecret.trim()) {
      toast.error("Ingresá un secret o usá Generar.");
      return;
    }
    start(async () => {
      const res = await setWaSecret(newSecret.trim());
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Secret guardado");
      setNewSecret("");
      router.refresh();
    });
  }

  function regen() {
    start(async () => {
      const res = await regenerateWaSecret();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setGenerated(res.secret);
      toast.success("Secret nuevo generado");
      router.refresh();
    });
  }

  function reenqueue() {
    if (!confirm("¿Reintentar todos los mensajes fallidos?")) return;
    start(async () => {
      const res = await reenqueueFailed();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcados como pendientes");
      router.refresh();
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          Integración WhatsApp (Botly)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cuando el bot de Botly esté conectado, va a leer los mensajes
          pendientes de la cola y enviarlos por WhatsApp. Acá configurás el
          secret que Botly usa para autenticarse contra la base.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Pendientes" value={stats.pendiente} color="amber" />
          <Stat label="Enviados" value={stats.enviado} color="emerald" />
          <Stat label="Fallidos" value={stats.fallido} color="red" />
          <Stat label="Opt-in users" value={stats.optinUsers} color="primary" />
        </div>

        {/* Secret */}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold">
              Secret para Botly{" "}
              {hasSecret ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  configurado
                </span>
              ) : (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  sin configurar
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={regen}
              disabled={pending}
              className="gap-1 text-xs"
              title="Generar uno nuevo aleatorio"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Generar
            </Button>
          </div>

          {generated && (
            <div className="mb-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-[11px] text-amber-900 dark:text-amber-200">
                <b>Nuevo secret (guardalo ya, no se va a volver a mostrar):</b>
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {generated}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(generated)}
                  className="h-7 gap-1 px-2"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                type={show ? "text" : "password"}
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="Pegá un secret o tocá Generar"
                className="h-8 font-mono text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShow((v) => !v)}
              className="h-8 px-2"
              title={show ? "Ocultar" : "Mostrar"}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={pending || !newSecret}
              className="h-8"
            >
              Guardar
            </Button>
          </div>
        </div>

        {/* Instrucciones para Botly */}
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
            Cómo conectar Botly a la cola →
          </summary>
          <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3 text-[11px]">
            <p>
              <b>1.</b> Generá un secret arriba y guardalo. Tomi lo va a usar
              como auth.
            </p>
            <p>
              <b>2.</b> Endpoint de Supabase para leer pendientes (POST):
            </p>
            <code className="block break-all rounded bg-background p-2">
              {baseUrl}/rest/v1/rpc/jd_wa_queue_pending
            </code>
            <p>
              Body: <code>{`{"p_secret":"<EL_SECRET>","p_limit":50}`}</code>
            </p>
            <p>
              <b>3.</b> Endpoint para marcar enviado/fallido:
            </p>
            <code className="block break-all rounded bg-background p-2">
              {baseUrl}/rest/v1/rpc/jd_wa_queue_mark
            </code>
            <p>
              Body: <code>{`{"p_secret":"…","p_id":"<uuid>","p_status":"enviado|fallido","p_error":null}`}</code>
            </p>
            <p>
              <b>4.</b> Header requerido en ambos:{" "}
              <code>apikey: &lt;anon-key&gt;</code> (cualquiera autenticado o
              anon sirve, la auth real la valida el secret).
            </p>
            <p>
              <b>5.</b> Sugerido: Botly hace polling cada 15-30s o se dispara
              por webhook. Por cada mensaje, manda WA al{" "}
              <code>phone</code> con el texto de <code>mensaje</code> y marca{" "}
              <code>enviado</code> cuando confirma OK.
            </p>
          </div>
        </details>

        {stats.fallido > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={reenqueue}
            disabled={pending}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reintentar fallidos ({stats.fallido})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "amber" | "emerald" | "red" | "primary";
}) {
  const cls = {
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
    primary: "bg-primary/15 text-foreground",
  }[color];
  return (
    <div className={`rounded-md ${cls} px-3 py-2 text-center`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
