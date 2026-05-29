"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RotateCw,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  applyDirectorIdea,
  runWeeklyNow,
  runMonthlyNow,
} from "@/app/(app)/director/actions";
import type { DirectorIdea } from "@/lib/director/insight";

export interface DirectorReportView {
  id: string;
  cliente_nombre: string;
  pack: string | null;
  status: "al_dia" | "brechas";
  quota_reels: number;
  quota_posts: number;
  proy_reels: number;
  proy_posts: number;
  pub_reels: number;
  pub_posts: number;
  pub_reels_week: number;
  pub_posts_week: number;
  pipeline_next: number;
  resumen: string;
  ideas: DirectorIdea[];
}

function IdeaRow({
  reportId,
  index,
  idea,
}: {
  reportId: string;
  index: number;
  idea: DirectorIdea;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [applied, setApplied] = useState(!!idea.applied_pub_id);

  function apply() {
    start(async () => {
      const res = await applyDirectorIdea(reportId, index);
      if (res?.error) {
        toast.error(res.error);
        if (res.error.includes("ya fue agregada")) setApplied(true);
        return;
      }
      setApplied(true);
      toast.success("Idea agregada al calendario (estado: idea)");
      router.refresh();
    });
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{idea.titulo}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {idea.tipo}
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {idea.red}
          </span>
          {idea.pilar && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {idea.pilar}
            </span>
          )}
        </div>
        {idea.copy && <p className="mt-1 text-xs text-muted-foreground">{idea.copy}</p>}
      </div>
      <Button
        size="sm"
        variant={applied ? "outline" : "default"}
        disabled={pending || applied}
        onClick={apply}
        className="shrink-0"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : applied ? (
          <>
            <Check className="mr-1 h-3.5 w-3.5" /> Agregada
          </>
        ) : (
          <>
            <Plus className="mr-1 h-3.5 w-3.5" /> Al calendario
          </>
        )}
      </Button>
    </div>
  );
}

/** Mini-barra contratado vs subido. */
function MetricPill({
  label,
  reels,
  posts,
  quotaR,
  quotaP,
}: {
  label: string;
  reels: number;
  posts: number;
  quotaR?: number;
  quotaP?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {reels}
        {quotaR !== undefined && <span className="text-muted-foreground">/{quotaR}</span>} reels
      </span>
      <span className="font-medium">
        {posts}
        {quotaP !== undefined && <span className="text-muted-foreground">/{quotaP}</span>} posts
      </span>
    </span>
  );
}

function ReportCard({ r }: { r: DirectorReportView }) {
  const [open, setOpen] = useState(false);
  const brechas = r.status === "brechas";

  return (
    <Card className={cn(brechas && "border-orange-400/40")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{r.cliente_nombre}</span>
            {r.pack && (
              <span className="shrink-0 text-[11px] text-muted-foreground">{r.pack}</span>
            )}
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                brechas
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              )}
            >
              {brechas ? "Con brechas" : "Al día"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <MetricPill
              label="Mes"
              reels={r.pub_reels}
              posts={r.pub_posts}
              quotaR={r.quota_reels}
              quotaP={r.quota_posts}
            />
            <MetricPill label="Semana" reels={r.pub_reels_week} posts={r.pub_posts_week} />
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <CardContent className="space-y-3 border-t p-4 pt-3">
          <p className="text-sm leading-relaxed">{r.resumen}</p>

          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Contratado</div>
              <div className="font-medium">
                {r.quota_reels} reels · {r.quota_posts} posts
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Subido esta semana</div>
              <div className="font-medium">
                {r.pub_reels_week} reels · {r.pub_posts_week} posts
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Subido este mes</div>
              <div className="font-medium">
                {r.pub_reels} reels · {r.pub_posts} posts
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Planeado / pipeline</div>
              <div className="font-medium">
                {r.proy_reels}r · {r.proy_posts}p · {r.pipeline_next} en 2 sem
              </div>
            </div>
          </div>

          {r.ideas.length > 0 && (
            <div className="space-y-1.5 border-t pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Ideas sugeridas
              </div>
              {r.ideas.map((idea, i) => (
                <IdeaRow key={i} reportId={r.id} index={i} idea={idea} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function DirectorDashboard({
  reports,
  semanas,
  selectedSemana,
  isStaff,
}: {
  reports: DirectorReportView[];
  semanas: string[];
  selectedSemana: string | null;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [pendingWeekly, startWeekly] = useTransition();
  const [pendingMonthly, startMonthly] = useTransition();

  function genWeekly() {
    startWeekly(async () => {
      const res = await runWeeklyNow();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Parte semanal regenerado");
      router.refresh();
    });
  }
  function genMonthly() {
    startMonthly(async () => {
      const res = await runMonthlyNow();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Reportes del mes pasado preparados (${(res as { prepared?: number }).prepared ?? 0})`
      );
      router.refresh();
    });
  }

  function fmtSemana(s: string) {
    return new Date(s + "T12:00:00").toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {semanas.length > 0 && (
          <select
            value={selectedSemana ?? ""}
            onChange={(e) => router.push(`/director?semana=${e.target.value}`)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {semanas.map((s) => (
              <option key={s} value={s}>
                Parte del {fmtSemana(s)}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isStaff && (
            <>
              <Button size="sm" variant="outline" onClick={genWeekly} disabled={pendingWeekly}>
                {pendingWeekly ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Generar semanal
              </Button>
              <Button size="sm" variant="outline" onClick={genMonthly} disabled={pendingMonthly}>
                {pendingMonthly ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                )}
                Generar mensual
              </Button>
            </>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay reportes para esta semana. {isStaff && "Usá “Generar semanal” para crear uno ahora."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
