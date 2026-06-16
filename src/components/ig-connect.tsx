"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AtSign, Search, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listIgAccounts,
  connectIgAccount,
  disconnectIgAccount,
} from "@/app/(app)/clientes/[id]/resultados/actions";

type Option = {
  igUserId: string;
  igUsername: string | null;
  pageName: string;
  profilePicture: string | null;
};

export function IgConnect({
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
  const [options, setOptions] = useState<Option[] | null>(null);
  const [manualId, setManualId] = useState("");

  function detect() {
    start(async () => {
      const res = await listIgAccounts();
      if ("error" in res) return void toast.error(res.error);
      if (res.cuentas.length === 0)
        return void toast.message(
          "No aparecieron cuentas de Instagram en el token. Revisá que la página esté asignada al system user y que el token tenga los permisos de Instagram."
        );
      setOptions(res.cuentas);
    });
  }

  function connect(igUserId: string, igUsername: string | null) {
    start(async () => {
      const res = await connectIgAccount(clientId, igUserId, igUsername);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Instagram conectado.");
      setOptions(null);
      router.refresh();
    });
  }

  function disconnect() {
    start(async () => {
      const res = await disconnectIgAccount(clientId);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Instagram desconectado.");
      router.refresh();
    });
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <AtSign className="h-4 w-4 text-primary" />
          Conectado{username ? <b>@{username}</b> : null}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={disconnect}
          disabled={pending}
          className="h-8 gap-1.5 text-muted-foreground"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        Conectá la cuenta de Instagram del cliente para traer los resultados
        automáticamente. La cuenta debe ser <b>Business/Creator</b> y estar vinculada
        a una página de Facebook asignada a tu system user.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={detect} disabled={pending} className="h-9 gap-1.5">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Detectar cuentas
        </Button>
        <span className="text-xs text-muted-foreground">
          o pegá el ID a mano abajo
        </span>
      </div>

      {options && options.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Elegí la cuenta del cliente:
          </div>
          {options.map((o) => (
            <button
              key={o.igUserId}
              type="button"
              onClick={() => connect(o.igUserId, o.igUsername)}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-muted disabled:opacity-50"
            >
              {o.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.profilePicture} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <AtSign className="h-7 w-7 rounded-full bg-muted p-1.5 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {o.igUsername ? `@${o.igUsername}` : o.igUserId}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{o.pageName}</span>
              </span>
              <Link2 className="h-4 w-4 shrink-0 text-primary" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="ID numérico de la cuenta (17841…)"
          className="h-9 flex-1 font-mono text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => connect(manualId, null)}
          disabled={pending || !manualId.trim()}
          className="h-9 gap-1.5"
        >
          <Link2 className="h-4 w-4" /> Conectar
        </Button>
      </div>
    </div>
  );
}
