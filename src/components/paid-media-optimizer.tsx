"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wand2,
  Loader2,
  Check,
  X,
  ArrowRight,
  Pause,
  Play,
  DollarSign,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  suggestChanges,
  applyChange,
  rollbackChange,
} from "@/app/(app)/clientes/[id]/pauta/analisis/actions";
import type { ProposedChange } from "@/lib/paid-media/suggest";

export interface AppliedChange {
  id: string;
  tipo: string;
  nivel: string;
  target_nombre: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  motivo: string | null;
  estado: string;
  aplicado_at: string;
}

const PRIO: Record<string, string> = {
  alta: "bg-red-500/15 text-red-700 dark:text-red-300",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  baja: "bg-muted text-muted-foreground",
};

function money(v: number | string | null, moneda: string) {
  const n = Number(v);
  return Number.isFinite(n) ? `${moneda} ${n.toLocaleString("es-AR")}` : String(v ?? "—");
}

function ChangeIcon({ tipo }: { tipo: string }) {
  if (tipo === "presupuesto") return <DollarSign className="h-4 w-4 text-primary" />;
  if (tipo === "pausar") return <Pause className="h-4 w-4 text-amber-600" />;
  return <Play className="h-4 w-4 text-emerald-600" />;
}

function describe(c: ProposedChange, moneda: string) {
  const t = c.nivel === "conjunto" ? "Conjunto" : "Campaña";
  if (c.tipo === "presupuesto") {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <b>Presupuesto</b> · {t} <i>{c.target_nombre}</i>:
        <span className="tabular-nums text-muted-foreground">{money(c.valor_actual, moneda)}</span>
        <ArrowRight className="h-3.5 w-3.5" />
        <span className="font-semibold tabular-nums">{money(c.valor_nuevo, moneda)}</span>
      </span>
    );
  }
  return (
    <span>
      <b>{c.tipo === "pausar" ? "Pausar" : "Activar"}</b> · {t} <i>{c.target_nombre}</i>
    </span>
  );
}

export function PaidMediaOptimizer({
  clienteId,
  moneda,
  canApply,
  initialHistory,
}: {
  clienteId: string;
  moneda: string;
  canApply: boolean;
  initialHistory: AppliedChange[];
}) {
  const router = useRouter();
  const [cambios, setCambios] = useState<ProposedChange[] | null>(null);
  const [loading, startLoad] = useTransition();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [rollingId, setRollingId] = useState<string | null>(null);

  function generar() {
    startLoad(async () => {
      const res = await suggestChanges(clienteId);
      if ("error" in res) return void toast.error(res.error);
      setCambios(res.cambios);
      setConfirming(null);
      if (res.cambios.length === 0) toast.info("La IA no encontró cambios claros para sugerir ahora.");
    });
  }

  async function aplicar(idx: number) {
    if (!cambios) return;
    setApplyingIdx(idx);
    const res = await applyChange(clienteId, cambios[idx]);
    setApplyingIdx(null);
    if ("error" in res) return void toast.error(res.error);
    toast.success("Cambio aplicado en Meta.");
    setCambios((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
    setConfirming(null);
    router.refresh();
  }

  async function revertir(id: string) {
    if (!confirm("¿Revertir este cambio? Vuelve al valor anterior en Meta.")) return;
    setRollingId(id);
    const res = await rollbackChange(id);
    setRollingId(null);
    if ("error" in res) return void toast.error(res.error);
    toast.success("Cambio revertido.");
    router.refresh();
  }

  const history = initialHistory;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="h-4 w-4 text-primary" /> Optimizaciones sugeridas
          </h3>
          <p className="text-xs text-muted-foreground">
            La IA propone cambios concretos en campañas y conjuntos. {canApply ? "Aplicalos con un clic (te pide confirmar)." : "Solo lectura (no tenés permiso para aplicar)."}
          </p>
        </div>
        <Button size="sm" onClick={generar} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {cambios ? "Volver a sugerir" : "Sugerir cambios"}
        </Button>
      </div>

      {/* Propuestas */}
      {cambios && cambios.length > 0 && (
        <ul className="space-y-2">
          {cambios.map((c, idx) => (
            <li key={`${c.target_id}-${idx}`} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <ChangeIcon tipo={c.tipo} />
                <div className="min-w-0 flex-1 text-sm">
                  {describe(c, moneda)}
                  <p className="mt-1 text-xs text-muted-foreground">{c.motivo}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", PRIO[c.prioridad])}>
                  {c.prioridad}
                </span>
              </div>

              {canApply && (
                <div className="mt-2 flex justify-end gap-2">
                  {confirming === idx ? (
                    <>
                      <span className="mr-auto inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> ¿Confirmás este cambio en Meta?
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={applyingIdx === idx}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => aplicar(idx)} disabled={applyingIdx === idx} className="gap-1">
                        {applyingIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Confirmar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirming(idx)}>
                      Aplicar
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cambios && cambios.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
          No hay cambios sugeridos por ahora. La cuenta viene equilibrada o faltan datos.
        </p>
      )}

      {/* Historial de cambios aplicados */}
      {history.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">Cambios aplicados</div>
          <ul className="space-y-1.5">
            {history.map((h) => {
              const revertido = h.estado === "revertido";
              return (
                <li key={h.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                  <ChangeIcon tipo={h.tipo} />
                  <span className={cn("min-w-0 flex-1 truncate", revertido && "text-muted-foreground line-through")}>
                    {h.tipo === "presupuesto"
                      ? `${h.nivel} ${h.target_nombre}: ${money(h.valor_anterior, moneda)} → ${money(h.valor_nuevo, moneda)}`
                      : `${h.tipo === "pausar" ? "Pausó" : "Activó"} ${h.nivel} ${h.target_nombre}`}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(h.aplicado_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </span>
                  {revertido ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">revertido</span>
                  ) : canApply ? (
                    <button
                      type="button"
                      onClick={() => revertir(h.id)}
                      disabled={rollingId === h.id}
                      className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-primary hover:underline disabled:opacity-50"
                    >
                      {rollingId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                      Revertir
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
