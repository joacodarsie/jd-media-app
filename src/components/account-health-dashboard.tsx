"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ListChecks,
  CircleAlert,
  CircleCheck,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { generateDirectorSummary } from "@/app/(app)/director/actions";
import type { AccountHealth, Semaforo } from "@/lib/director/health";

const SEMAFORO_META: Record<
  Semaforo,
  { label: string; dot: string; border: string; chip: string }
> = {
  bien: {
    label: "Bien",
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  regular: {
    label: "Regular",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  mal: {
    label: "Mal",
    dot: "bg-red-500",
    border: "border-l-red-500",
    chip: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

function Chip({
  icon,
  children,
  tone = "muted",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "good" | "bad";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
        tone === "muted" && "bg-muted/60 text-foreground",
        tone === "good" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        tone === "bad" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function AccountCard({ c }: { c: AccountHealth }) {
  const [open, setOpen] = useState(c.semaforo === "mal");
  const meta = SEMAFORO_META[c.semaforo];
  const tieneDetalle = c.alertas.length > 0 || c.buenas.length > 0;

  return (
    <div className={cn("rounded-lg border border-l-4 bg-card", meta.border)}>
      <button
        type="button"
        onClick={() => tieneDetalle && setOpen((o) => !o)}
        className="flex w-full items-start gap-2.5 p-3 text-left"
      >
        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{c.nombre}</span>
            {c.pack && (
              <span className="shrink-0 text-[11px] text-muted-foreground">{c.pack}</span>
            )}
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", meta.chip)}>
              {meta.label}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.planMeta > 0 ? (
              <Chip icon={<ListChecks className="h-3 w-3" />}>
                Plan {c.planHechas}/{c.planMeta}
              </Chip>
            ) : (
              <Chip>Sin cuota fija</Chip>
            )}
            {c.igConectado && c.igDelta != null ? (
              <Chip
                tone={c.igDelta < 0 ? "bad" : c.igDelta > 0 ? "good" : "muted"}
                icon={
                  c.igDelta < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )
                }
              >
                IG {c.igDelta >= 0 ? "+" : ""}
                {c.igDelta}
              </Chip>
            ) : (
              <Chip>IG s/datos</Chip>
            )}
            {c.tareasVencidas > 0 && (
              <Chip tone="bad">{c.tareasVencidas} tareas vencidas</Chip>
            )}
          </div>
        </div>
        {tieneDetalle && (
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && tieneDetalle && (
        <div className="space-y-1.5 border-t px-3 py-2.5">
          {c.alertas.map((a, i) => (
            <div key={`a${i}`} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
          {c.buenas.map((b, i) => (
            <div key={`b${i}`} className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{b}</span>
            </div>
          ))}
          <Link
            href={`/reporte/cliente/${c.id}`}
            className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
          >
            Ver reporte completo <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function AccountHealthDashboard({
  cuentas,
  resumen,
  periodoLabel,
  canGenerate,
}: {
  cuentas: AccountHealth[];
  resumen: { bien: number; regular: number; mal: number; total: number };
  periodoLabel: string;
  canGenerate: boolean;
}) {
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generar() {
    start(async () => {
      const res = await generateDirectorSummary();
      if ("error" in res && res.error) return void toast.error(res.error);
      setTexto(res.texto ?? null);
      toast.success("Resumen generado.");
    });
  }

  function copy() {
    if (!texto) return;
    navigator.clipboard?.writeText(texto).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      {/* Resumen general + acción */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {resumen.bien} bien
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> {resumen.regular} regular
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {resumen.mal} mal
          </span>
          <span className="text-xs text-muted-foreground">· {periodoLabel}</span>
        </div>
        {canGenerate && (
          <button
            type="button"
            onClick={generar}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-60 dark:bg-transparent"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-violet-600" />
            )}
            {texto ? "Regenerar resumen IA" : "Generar resumen con IA"}
          </button>
        )}
      </div>

      {/* Resumen IA (efímero) */}
      {texto && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" /> Parte de seguimiento
            </div>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <Markdown>{texto}</Markdown>
        </div>
      )}

      {/* Cuentas (peor primero) */}
      {cuentas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay cuentas activas para analizar.
        </p>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {cuentas.map((c) => (
            <AccountCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
