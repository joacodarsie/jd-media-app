"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AtSign, Check, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bulkConnectIg } from "@/app/(app)/clientes/conectar-instagram/actions";
import type { IgCuenta, MotivoMatch } from "@/lib/social/ig-match";

export interface FilaConexion {
  clienteId: string;
  nombre: string;
  instagramUrl: string | null;
  sugerida: IgCuenta | null;
  motivo: MotivoMatch;
}

const SIN = "__sin__";

const MOTIVO_LABEL: Record<Exclude<MotivoMatch, null>, { txt: string; clase: string }> = {
  handle: {
    txt: "coincide el @ de la ficha",
    clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  nombre: {
    txt: "coincide por nombre — revisalo",
    clase: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

/**
 * Tabla para conectar de una sola vez las cuentas de Instagram que faltan.
 * Cada fila viene con la cuenta sugerida ya elegida; el que aprueba solo revisa
 * y confirma. Las sugerencias por nombre quedan marcadas en ámbar porque son
 * las que hay que mirar dos veces.
 */
export function IgBulkConnect({
  filas,
  cuentas,
}: {
  filas: FilaConexion[];
  cuentas: IgCuenta[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [elegido, setElegido] = useState<Record<string, string>>(() =>
    Object.fromEntries(filas.map((f) => [f.clienteId, f.sugerida?.igUserId ?? SIN]))
  );

  // Una cuenta elegida en una fila no puede ofrecerse en otra.
  const usadas = useMemo(() => {
    const m = new Map<string, string>(); // igUserId → clienteId
    for (const [cid, ig] of Object.entries(elegido)) if (ig !== SIN) m.set(ig, cid);
    return m;
  }, [elegido]);

  const aConectar = filas.filter((f) => elegido[f.clienteId] && elegido[f.clienteId] !== SIN);

  async function conectar() {
    if (aConectar.length === 0) return;
    setGuardando(true);
    const pares = aConectar.map((f) => {
      const igUserId = elegido[f.clienteId];
      const c = cuentas.find((x) => x.igUserId === igUserId);
      return { clienteId: f.clienteId, igUserId, igUsername: c?.igUsername ?? null };
    });
    const res = await bulkConnectIg(pares);
    setGuardando(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${res.conectadas} cuenta(s) conectada(s). Los datos entran solos con el sync diario.`
    );
    startTransition(() => router.refresh());
  }

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        <Check className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
        Todas las cuentas activas tienen Instagram conectado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">@ en la ficha</th>
              <th className="px-3 py-2">Cuenta de Instagram a conectar</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const val = elegido[f.clienteId] ?? SIN;
              const meta = f.motivo && val === f.sugerida?.igUserId ? MOTIVO_LABEL[f.motivo] : null;
              return (
                <tr key={f.clienteId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/clientes/${f.clienteId}`} className="font-medium hover:underline">
                      {f.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {f.instagramUrl ? (
                      <a
                        href={f.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Link2 className="h-3 w-3" />
                        {f.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="opacity-60">sin cargar</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={val}
                        onChange={(e) =>
                          setElegido((p) => ({ ...p, [f.clienteId]: e.target.value }))
                        }
                        className="max-w-[300px] rounded-md border bg-background px-2 py-1 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value={SIN}>— No conectar todavía —</option>
                        {cuentas
                          .filter(
                            (c) =>
                              !usadas.has(c.igUserId) || usadas.get(c.igUserId) === f.clienteId
                          )
                          .map((c) => (
                            <option key={c.igUserId} value={c.igUserId}>
                              {c.igUsername ? `@${c.igUsername}` : c.pageName}
                            </option>
                          ))}
                      </select>
                      {meta && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            meta.clase
                          )}
                        >
                          {meta.txt}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={conectar} disabled={guardando || aConectar.length === 0} className="gap-2">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <AtSign className="h-4 w-4" />}
          Conectar {aConectar.length} cuenta{aConectar.length === 1 ? "" : "s"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Los seguidores y el alcance entran solos con el sync diario. Para verlos ya,
          entrá a Resultados del cliente y tocá &quot;Actualizar&quot;.
        </span>
      </div>
    </div>
  );
}
