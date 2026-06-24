"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyzeFinances } from "@/app/(app)/finanzas/advisor-actions";

interface Recomendacion {
  titulo: string;
  detalle: string;
  prioridad: "alta" | "media" | "baja";
  link: string | null;
}

export interface AdviceData {
  score: number | null;
  estado: string | null;
  fortalezas: string[];
  riesgos: string[];
  recomendaciones: Recomendacion[];
  generado_at: string | null;
}

const PRIO: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  baja: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function scoreColor(s: number): string {
  if (s >= 70) return "text-emerald-600";
  if (s >= 40) return "text-amber-600";
  return "text-red-600";
}

export function FinancialAdvisorCard({
  period,
  advice,
}: {
  period: string;
  advice: AdviceData | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    const t = toast.loading("Analizando tus finanzas…");
    start(async () => {
      const res = await analyzeFinances(period);
      if ("error" in res) return void toast.error(res.error, { id: t });
      toast.success("Análisis actualizado", { id: t });
      router.refresh();
    });
  }

  const generado = advice?.generado_at
    ? new Date(advice.generado_at).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {advice?.score != null && (
              <div className="text-center">
                <div className={cn("text-3xl font-bold tabular-nums", scoreColor(advice.score))}>
                  {advice.score}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  salud
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Asesor financiero
              </div>
              <p className="mt-0.5 max-w-xl text-sm font-medium">
                {advice?.estado ?? "Generá un análisis con IA de cómo venís y qué hacer este mes."}
              </p>
              {generado && (
                <p className="text-[11px] text-muted-foreground">Actualizado el {generado}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant={advice ? "outline" : "default"} onClick={run} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : advice ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {advice ? "Actualizar" : "Analizar mis finanzas"}
          </Button>
        </div>

        {advice && (advice.fortalezas.length > 0 || advice.riesgos.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {advice.fortalezas.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fortalezas
                </div>
                <ul className="space-y-1 text-sm">
                  {advice.fortalezas.map((f, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-emerald-600">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {advice.riesgos.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Riesgos
                </div>
                <ul className="space-y-1 text-sm">
                  {advice.riesgos.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-red-600">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {advice && advice.recomendaciones.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Qué hacer
            </div>
            <ul className="space-y-2">
              {advice.recomendaciones.map((r, i) => (
                <li key={i} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", PRIO[r.prioridad])}>
                          {r.prioridad}
                        </span>
                        <span className="font-semibold">{r.titulo}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.detalle}</p>
                    </div>
                    {r.link && (
                      <Link
                        href={r.link}
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ir <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
