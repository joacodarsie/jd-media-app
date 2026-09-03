"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  marcarCobrado,
  desmarcarCobrado,
  guardarMonto,
  guardarNota,
  guardarEtapaCobro,
  registrarPagoParcial,
  borrarPagoParcial,
} from "@/app/(app)/cobros/actions";
import { ETAPAS, estadoDeCobro } from "@/lib/finanzas/cobro-gestion";

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
  /** En qué punto de la conversación de cobro está. */
  etapa?: string | null;
  /** Entregas a cuenta, de la más vieja a la más nueva. */
  pagos?: { id: string; monto: number; fecha: string; nota: string | null }[];
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
        const pagos = f.pagos ?? [];
        // La etapa sale de los números, no del último clic: si entregó algo,
        // está "pagó una parte" aunque nadie haya tocado el selector.
        const est = estadoDeCobro({
          monto: f.monto,
          pagos,
          etapaGuardada: f.etapa,
          cobradoEl: f.cobradoEl,
        });
        const pagado = est.saldado;
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

            {/* La etapa y las entregas a cuenta: lo que pasa entre "le escribí"
                y "me pagó", que es donde se pierde la plata. */}
            {!pagado && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ETAPAS.filter((e) => e.value !== "cobrado" && e.value !== "parcial").map((e) => (
                  <button
                    key={e.value}
                    title={e.ayuda}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await guardarEtapaCobro({
                          clienteId: f.clienteId,
                          periodo,
                          etapa: e.value,
                          monto: f.monto,
                          concepto: `Abono ${periodo}`,
                        });
                        if ("error" in res && res.error) toast.error(res.error);
                        router.refresh();
                      })
                    }
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80 ${
                      est.etapa === e.value ? e.badge : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
                <EntregaParcial
                  saldo={est.saldo}
                  disabled={pending}
                  onGuardar={(montoEntregado, fecha, nota) =>
                    start(async () => {
                      const res = await registrarPagoParcial({
                        clienteId: f.clienteId,
                        periodo,
                        monto: f.monto,
                        concepto: `Abono ${periodo}`,
                        montoEntregado,
                        fecha,
                        nota,
                      });
                      if ("error" in res && res.error) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(
                        "saldado" in res && res.saldado
                          ? `${f.nombre} completó el pago ✅`
                          : `Anotado. Le quedan $${(f.monto - (("entregado" in res ? res.entregado : 0) || 0)).toLocaleString("es-AR")}`,
                      );
                      router.refresh();
                    })
                  }
                />
              </div>
            )}

            {pagos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {pagos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
                  >
                    <span className="font-medium tabular-nums">
                      ${Number(p.monto).toLocaleString("es-AR")}
                    </span>
                    <span className="text-muted-foreground">
                      el {p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)}
                    </span>
                    {p.nota && <span className="truncate text-muted-foreground">· {p.nota}</span>}
                    <button
                      title="Borrar esta entrega"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await borrarPagoParcial(p.id);
                          if ("error" in res && res.error) toast.error(res.error);
                          router.refresh();
                        })
                      }
                      className="ml-auto shrink-0 text-muted-foreground hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {!pagado && (
                  <li className="px-2 text-xs font-medium text-violet-700 dark:text-violet-300">
                    Entregó ${est.entregado.toLocaleString("es-AR")} · le quedan $
                    {est.saldo.toLocaleString("es-AR")}
                  </li>
                )}
              </ul>
            )}

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

/**
 * "Me dio una parte": el caso que antes no tenía dónde anotarse y terminaba en
 * un chat de WhatsApp. Se abre en la misma fila, sin diálogo, para que anotar
 * una entrega cueste lo mismo que marcar el cobro completo.
 */
function EntregaParcial({
  saldo,
  disabled,
  onGuardar,
}: {
  saldo: number;
  disabled?: boolean;
  onGuardar: (monto: number, fecha: string, nota: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Me dio una parte
      </button>
    );
  }

  function guardar() {
    const n = Number(String(monto).replace(/[^\d]/g, ""));
    if (!(n > 0)) return;
    onGuardar(n, fecha, nota);
    setAbierto(false);
    setMonto("");
    setNota("");
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border bg-background p-2">
      <Input
        autoFocus
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setAbierto(false);
        }}
        placeholder={`Cuánto entregó (falta $${saldo.toLocaleString("es-AR")})`}
        className="h-8 w-48 text-xs"
        inputMode="numeric"
      />
      <Input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="h-8 w-36 text-xs"
      />
      <Input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && guardar()}
        placeholder="Aclaración (ej: el resto el viernes)"
        className="h-8 min-w-[180px] flex-1 text-xs"
      />
      <Button size="sm" className="h-8" onClick={guardar}>
        Anotar
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </div>
  );
}
