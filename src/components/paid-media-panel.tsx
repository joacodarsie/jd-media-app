"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Check, Pencil, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveAdAccountId, syncPaidMedia } from "@/app/(app)/paid-media/actions";

export interface PaidSuggestion {
  accion: string;
  motivo: string;
  prioridad: "alta" | "media" | "baja";
  campana?: string;
}
export interface PaidClient {
  id: string;
  nombre: string;
  adAccountId: string | null;
  snapshot: {
    fecha: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number | null;
    cpc: number | null;
    conversions: number;
    cost_per_conversion: number | null;
    moneda: string;
  } | null;
  analysis: {
    fecha: string;
    resumen: string;
    sugerencias: PaidSuggestion[];
  } | null;
}

const PRIO: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  baja: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function money(n: number, m: string) {
  return `${m} ${Math.round(n).toLocaleString("es-AR")}`;
}
function fmtFecha(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function PaidMediaPanel({
  clients,
}: {
  clients: PaidClient[];
  metaConfigured: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clients.map((c) => (
        <ClientCard key={c.id} client={c} />
      ))}
    </div>
  );
}

function ClientCard({ client }: { client: PaidClient }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!client.adAccountId);
  const [acct, setAcct] = useState(client.adAccountId ?? "");
  const s = client.snapshot;
  const a = client.analysis;

  function save() {
    start(async () => {
      const res = await saveAdAccountId(client.id, acct);
      if (res?.error) return void toast.error(res.error);
      toast.success("Cuenta guardada.");
      setEditing(false);
      router.refresh();
    });
  }
  function sync() {
    start(async () => {
      const res = await syncPaidMedia(client.id);
      if (res?.error) return void toast.error(res.error);
      toast.success("Métricas actualizadas.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold">{client.nombre}</div>
          {editing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Input
                value={acct}
                onChange={(e) => setAcct(e.target.value)}
                placeholder="act_123456789"
                className="h-7 w-44 text-xs"
              />
              <Button size="sm" className="h-7 px-2" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {client.adAccountId} <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={sync}
          disabled={pending || !client.adAccountId}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizar
        </Button>
      </div>

      <div className="flex-1 space-y-3 px-4 py-3">
        {s ? (
          <>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Métricas del {fmtFecha(s.fecha)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Metric label="Gasto" value={money(s.spend, s.moneda)} />
              <Metric label="Conversiones" value={String(s.conversions)} />
              <Metric
                label="Costo/conv"
                value={s.cost_per_conversion != null ? money(s.cost_per_conversion, s.moneda) : "—"}
              />
              <Metric label="Clicks" value={String(s.clicks)} />
              <Metric label="CTR" value={s.ctr != null ? `${s.ctr.toFixed(2)}%` : "—"} />
              <Metric label="CPC" value={s.cpc != null ? money(s.cpc, s.moneda) : "—"} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {client.adAccountId
              ? "Todavía sin datos. Tocá “Sincronizar”."
              : "Cargá el ID de la cuenta publicitaria para traer métricas."}
          </p>
        )}

        {a && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Análisis IA · {fmtFecha(a.fecha)}
            </div>
            {a.resumen && <p className="text-sm">{a.resumen}</p>}
            {a.sugerencias.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {a.sugerencias.map((sug, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        PRIO[sug.prioridad] ?? PRIO.media
                      )}
                    >
                      {sug.prioridad}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{sug.accion}</span>
                      {sug.campana && (
                        <span className="text-muted-foreground"> · {sug.campana}</span>
                      )}
                      {sug.motivo && (
                        <span className="block text-xs text-muted-foreground">{sug.motivo}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-semibold tabular-nums">{value}</div>
    </div>
  );
}
