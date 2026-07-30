"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  marcarCobrado,
  desmarcarCobrado,
  guardarMonto,
  guardarNota,
} from "@/app/(app)/cobros/actions";

export interface FilaCliente {
  clienteId: string;
  nombre: string;
  monto: number;
  cobradoEl: string | null;
  nota: string | null;
  contacto: string | null;
  telefono: string | null;
  /** Firmó pero todavía no pagó: no cuenta como cliente hasta que se cobre. */
  esperandoPago?: boolean;
}

export function CobrosSimple({ filas, periodo }: { filas: FilaCliente[]; periodo: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);

  if (!filas.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No hay cuentas activas con abono cargado.
      </p>
    );
  }

  function cobrar(f: FilaCliente) {
    start(async () => {
      const res = await marcarCobrado({
        clienteId: f.clienteId,
        periodo,
        monto: f.monto,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        "activado" in res && res.activado
          ? `${f.nombre} pagó ✅ — ahora sí cuenta como cliente`
          : `${f.nombre} pagó ✅`
      );
      router.refresh();
    });
  }

  function deshacer(f: FilaCliente) {
    start(async () => {
      const res = await desmarcarCobrado(f.clienteId, periodo);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {filas.map((f) => {
        const pagado = !!f.cobradoEl;
        return (
          <li key={f.clienteId} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {f.nombre}
                  {f.esperandoPago && !pagado && (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      title="Le mandaste la carta acuerdo pero todavía no pagó. No cuenta como cliente ni suma a la facturación hasta que marques el cobro."
                    >
                      Esperando pago
                    </span>
                  )}
                </p>
                {editando === f.clienteId ? (
                  <MontoEditor
                    inicial={f.monto}
                    onGuardar={(monto) =>
                      start(async () => {
                        const res = await guardarMonto({
                          clienteId: f.clienteId,
                          periodo,
                          monto,
                        });
                        if (res?.error) toast.error(res.error);
                        setEditando(null);
                        router.refresh();
                      })
                    }
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <button
                    onClick={() => setEditando(f.clienteId)}
                    className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="tabular-nums">${f.monto.toLocaleString("es-AR")}</span>
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                  </button>
                )}
              </div>

              {pagado ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Pagó el {f.cobradoEl?.slice(8, 10)}/{f.cobradoEl?.slice(5, 7)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deshacer(f)}
                    disabled={pending}
                    title="Deshacer"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => cobrar(f)} disabled={pending} className="min-w-[120px]">
                  <Check className="mr-1.5 h-4 w-4" /> Me pagó
                </Button>
              )}
            </div>

            <NotaInline
              inicial={f.nota ?? ""}
              onGuardar={(nota) =>
                start(async () => {
                  const res = await guardarNota({
                    clienteId: f.clienteId,
                    periodo,
                    nota,
                    monto: f.monto,
                  });
                  if (res?.error) toast.error(res.error);
                  else toast.success("Anotado");
                  router.refresh();
                })
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function MontoEditor({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial: number;
  onGuardar: (monto: number) => void;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState(String(inicial));
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onGuardar(Number(valor) || 0);
          if (e.key === "Escape") onCancelar();
        }}
        className="h-8 w-32 text-sm tabular-nums"
      />
      <Button size="sm" className="h-8" onClick={() => onGuardar(Number(valor) || 0)}>
        Guardar
      </Button>
    </div>
  );
}

/** La anotación que hoy vive en la cabeza: se guarda al salir del campo. */
function NotaInline({
  inicial,
  onGuardar,
}: {
  inicial: string;
  onGuardar: (nota: string) => void;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        if (valor.trim() !== inicial.trim()) onGuardar(valor);
      }}
      placeholder="Anotá algo (me paga el 10, pagó la mitad…)"
      className="mt-2 w-full rounded-md border-0 bg-muted/40 px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
