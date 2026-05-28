"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { applyDirectorIdea } from "@/app/(app)/director/actions";
import type { DirectorIdea } from "@/lib/director/insight";

export interface DirectorReportView {
  id: string;
  cliente_nombre: string;
  pack: string | null;
  status: "al_dia" | "brechas";
  faltan_reels: number;
  faltan_posts: number;
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
        {idea.copy && (
          <p className="mt-1 text-xs text-muted-foreground">{idea.copy}</p>
        )}
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

function ReportCard({ r }: { r: DirectorReportView }) {
  const brechas = r.status === "brechas";
  return (
    <Card className={cn(brechas && "border-orange-400/40")}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{r.cliente_nombre}</span>
            {r.pack && (
              <span className="text-[11px] text-muted-foreground">{r.pack}</span>
            )}
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              brechas
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            )}
          >
            {brechas ? "Con brechas" : "Al día"}
          </span>
        </div>

        <p className="text-sm leading-relaxed">{r.resumen}</p>

        {(r.faltan_reels > 0 || r.faltan_posts > 0 || r.pipeline_next < 3) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {r.faltan_reels > 0 && <span>Faltan {r.faltan_reels} reels</span>}
            {r.faltan_posts > 0 && <span>· Faltan {r.faltan_posts} posts</span>}
            <span>· {r.pipeline_next} pubs en 2 semanas</span>
          </div>
        )}

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
    </Card>
  );
}

export function DirectorReportList({
  reports,
}: {
  reports: DirectorReportView[];
}) {
  if (reports.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Todavía no hay reportes. El Director Creativo corre los viernes y vas a
        ver acá cómo viene cada cliente.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reports.map((r) => (
        <ReportCard key={r.id} r={r} />
      ))}
    </div>
  );
}
