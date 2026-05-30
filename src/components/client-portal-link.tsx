"use client";

import { useState } from "react";
import { Globe, Copy as CopyIcon, Check, RotateCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  generateClientPortalToken,
  revokeClientPortalToken,
} from "@/app/(app)/clientes/[id]/portal-actions";

interface Props {
  clienteId: string;
  initialToken: string | null;
  initialLastSeen: string | null;
}

export function ClientPortalLink({ clienteId, initialToken, initialLastSeen }: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [lastSeen] = useState<string | null>(initialLastSeen);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${token}`
    : null;

  async function handleGenerate() {
    setPending(true);
    const r = await generateClientPortalToken(clienteId);
    setPending(false);
    if (!r.ok) toast.error(r.error);
    else {
      setToken(r.data?.token ?? null);
      toast.success("Link del portal generado.");
    }
  }

  async function handleRevoke() {
    if (!confirm("¿Revocar el link actual? El cliente dejará de poder acceder.")) return;
    setPending(true);
    const r = await revokeClientPortalToken(clienteId);
    setPending(false);
    if (!r.ok) toast.error(r.error);
    else {
      setToken(null);
      toast.success("Link revocado.");
    }
  }

  function copyToClipboard() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("No se pudo copiar.")
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Link para el cliente</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        <b>Un solo link, sin login.</b> Desde acá el cliente ve su plan del mes,{" "}
        <b>aprueba o pide cambios</b> en las piezas pendientes, y ve lo que viene.
        Es el único link que necesitás mandarle.
      </p>

      {token && url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
            <span className="flex-1 truncate font-mono">{url}</span>
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {lastSeen && (
            <div className="text-[11px] text-muted-foreground">
              Última visita: {new Date(lastSeen).toLocaleString("es-AR")}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={pending}>
              <RotateCw className="mr-1 h-3.5 w-3.5" /> Regenerar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRevoke} disabled={pending}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Revocar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={handleGenerate} disabled={pending}>
          <Globe className="mr-1 h-3.5 w-3.5" /> Generar link
        </Button>
      )}
    </div>
  );
}
