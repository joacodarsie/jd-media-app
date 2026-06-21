"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Music2, Link2, Copy, Check, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTiktokAuthUrl,
  disconnectTiktok,
} from "@/app/(app)/clientes/[id]/resultados/actions";

/**
 * Conexión de TikTok del cliente (OAuth por cuenta). El staff genera el link y lo
 * abre con el cliente o se lo manda; el cliente autoriza su cuenta en TikTok.
 */
export function TiktokConnect({
  clientId,
  connected,
  username,
}: {
  clientId: string;
  connected: boolean;
  username: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function openAuth() {
    start(async () => {
      const res = await getTiktokAuthUrl(clientId);
      if ("error" in res) return void toast.error(res.error);
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function copyLink() {
    start(async () => {
      const res = await getTiktokAuthUrl(clientId);
      if ("error" in res) return void toast.error(res.error);
      await navigator.clipboard?.writeText(res.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copiado. Mandáselo al cliente para que conecte su TikTok.");
    });
  }

  function disconnect() {
    if (!confirm("¿Desconectar la cuenta de TikTok del cliente?")) return;
    start(async () => {
      const res = await disconnectTiktok(clientId);
      if ("error" in res) return void toast.error(res.error);
      toast.success("TikTok desconectado.");
      router.refresh();
    });
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <Music2 className="h-4 w-4 text-primary" />
          Conectado {username ? <b>@{username}</b> : null}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={disconnect}
          disabled={pending}
          className="h-8 gap-1.5 text-muted-foreground"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        Conectá la cuenta de TikTok del cliente para traer sus resultados al
        reporte. El cliente tiene que <b>autorizar su cuenta</b>: abrí el link con
        él, o copiáselo y mandáselo para que la vincule desde su celular.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={openAuth} disabled={pending} className="h-9 gap-1.5">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Conectar ahora
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copyLink}
          disabled={pending}
          className="h-9 gap-1.5"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copiar link para el cliente
        </Button>
      </div>
    </div>
  );
}
