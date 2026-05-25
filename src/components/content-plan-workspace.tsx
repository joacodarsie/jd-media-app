"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Archive,
  Calendar,
  Upload,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { approvePlan, archivePlan, applyPlanToCalendar } from "@/app/(app)/clientes/[id]/plan-mensual/actions";
import Link from "next/link";
import type { ContentPlanRow, MonthlyContentPlan } from "@/lib/content-plans/schema";

interface Props {
  clienteId: string;
  active: ContentPlanRow | null;
  draft: ContentPlanRow | null;
  history: ContentPlanRow[];
  defaultPeriodLabel: string;
}

type Phase = "idle" | "generating" | "saving";

export function ContentPlanWorkspace({
  clienteId,
  active,
  draft,
  history,
  defaultPeriodLabel,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [periodoLabel, setPeriodoLabel] = useState(defaultPeriodLabel);
  const [genProgress, setGenProgress] = useState(0);
  const [pending, setPending] = useState(false);

  // Input opcional del meet con cliente
  const [showMeetInput, setShowMeetInput] = useState(false);
  const [meetMode, setMeetMode] = useState<"pdf" | "text">("pdf");
  const [meetFile, setMeetFile] = useState<File | null>(null);
  const [meetText, setMeetText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tiene que ser un PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("PDF supera 20 MB.");
      return;
    }
    setMeetFile(f);
  }

  function fmtBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  // El "visible" es el draft activo si existe, sino el active aprobado.
  const visible = draft ?? active;
  const isDraft = visible?.status === "draft";

  async function generate() {
    if (!periodoLabel.trim()) {
      toast.error("Ponele un nombre al período (ej: 'Mayo 2026').");
      return;
    }
    if (draft) {
      if (!confirm("Ya hay un draft sin aprobar para este cliente. ¿Generar otro lo va a reemplazar al hacerlo aprobado. ¿Seguís?")) return;
    }
    setPhase("generating");
    setGenProgress(0);

    const form = new FormData();
    form.set("periodo_label", periodoLabel.trim());
    if (showMeetInput) {
      if (meetMode === "pdf" && meetFile) form.set("file", meetFile);
      else if (meetMode === "text" && meetText.trim().length >= 50) form.set("transcript", meetText.trim());
    }

    try {
      const res = await fetch(`/api/clientes/${clienteId}/plan/generate`, {
        method: "POST",
        body: form,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      let errMsg: string | null = null;

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as { type: string; [k: string]: unknown };
              if (evt.type === "progress") setGenProgress((evt.chars as number) ?? 0);
              else if (evt.type === "saving") setPhase("saving");
              else if (evt.type === "done") done = true;
              else if (evt.type === "error") errMsg = (evt.error as string) ?? "Error";
            } catch {
              /* */
            }
          }
        }
      }

      if (errMsg) throw new Error(errMsg);
      if (done) {
        toast.success("Plan generado. Revisalo y aprobá.");
        window.location.reload();
      } else {
        throw new Error("Generación terminó sin resultado.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
      setPhase("idle");
    }
  }

  async function handleApprove() {
    if (!draft) return;
    if (!confirm("¿Aprobar este plan? El anterior queda archivado.")) return;
    setPending(true);
    const r = await approvePlan(draft.id);
    setPending(false);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success("Plan aprobado.");
      window.location.reload();
    }
  }

  async function handleArchive(planId: string) {
    if (!confirm("¿Archivar este plan?")) return;
    setPending(true);
    const r = await archivePlan(planId);
    setPending(false);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success("Plan archivado.");
      window.location.reload();
    }
  }

  async function handleApplyToCalendar() {
    if (!active) return;
    if (!confirm(`¿Crear las publicaciones del plan en el calendario? Se van a generar ${active.content?.temas_destacados?.length ?? 0} ideas con estado 'idea' y fecha sugerida.`)) return;
    setPending(true);
    const r = await applyPlanToCalendar(active.id);
    setPending(false);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success(`Se crearon ${r.data?.created ?? 0} publicaciones en el calendario.`);
      window.location.reload();
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  if (phase === "generating" || phase === "saving") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {phase === "saving"
              ? "Guardando plan…"
              : genProgress > 0
              ? `Generando plan… ${genProgress.toLocaleString()} caracteres recibidos`
              : "Generando plan con IA (puede tardar 30-60 segundos)…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Generador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {visible ? "Generar nueva versión del plan" : "Generar plan de contenido"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            La IA toma el diagnóstico + el pack contratado + el historial de los últimos 60 días + lo que ya
            está planificado para proponer un plan operativo del período. Respeta las cuotas del pack.
          </p>
          <div className="flex gap-2">
            <Input
              value={periodoLabel}
              onChange={(e) => setPeriodoLabel(e.target.value)}
              placeholder="Ej: Mayo 2026"
              className="flex-1"
            />
            <Button onClick={generate} disabled={!periodoLabel.trim()}>
              <Sparkles className="mr-1 h-4 w-4" /> Generar
            </Button>
          </div>

          {/* Toggle meet opcional */}
          <button
            type="button"
            onClick={() => setShowMeetInput((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showMeetInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            ¿Tenés transcripción de un meet con el cliente para este período? (opcional)
          </button>

          {showMeetInput && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMeetMode("pdf")}
                  className={`rounded px-2 py-1 ${meetMode === "pdf" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  📄 Subir PDF
                </button>
                <button
                  type="button"
                  onClick={() => setMeetMode("text")}
                  className={`rounded px-2 py-1 ${meetMode === "text" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  ✏️ Pegar texto
                </button>
              </div>

              {meetMode === "pdf" ? (
                !meetFile ? (
                  <label
                    htmlFor="plan-meet-file"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition ${
                      isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-card hover:border-primary/60"
                    }`}
                  >
                    <Upload className="h-5 w-5 text-primary" />
                    <div>Arrastrá el PDF del meet o <span className="text-primary underline">clic para elegir</span></div>
                    <div className="text-xs text-muted-foreground">PDF · hasta 20 MB</div>
                    <input
                      id="plan-meet-file"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => pickFile(e.target.files?.[0])}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="truncate font-medium">{meetFile.name}</span>
                      <span className="text-xs text-muted-foreground">{fmtBytes(meetFile.size)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setMeetFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              ) : (
                <Textarea
                  value={meetText}
                  onChange={(e) => setMeetText(e.target.value)}
                  rows={6}
                  placeholder="Pegá la transcripción del meet con el cliente acá (mínimo 50 caracteres)."
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan visible (draft o active) */}
      {visible && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge variant={isDraft ? "secondary" : "default"}>
                {visible.status} · {visible.periodo_label}
              </Badge>
              {visible.generated_at && (
                <span className="text-xs text-muted-foreground">
                  Generado {new Date(visible.generated_at).toLocaleDateString("es-AR")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <Button size="sm" onClick={handleApprove} disabled={pending}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
                </Button>
              )}
              {!isDraft && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/plan/cliente/${clienteId}`} target="_blank">
                      <FileText className="mr-1 h-4 w-4" /> Ver PDF
                    </Link>
                  </Button>
                  {!visible.applied_at ? (
                    <Button size="sm" onClick={handleApplyToCalendar} disabled={pending}>
                      <CalendarPlus className="mr-1 h-4 w-4" /> Aplicar al calendario
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {visible.applied_count} publicaciones creadas
                    </span>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleArchive(visible.id)}
                disabled={pending}
              >
                <Archive className="mr-1 h-4 w-4" /> Archivar
              </Button>
            </div>
          </div>
          <PlanViewer plan={visible.content} />
        </div>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Historial ({history.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {history.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>
                    <Badge variant="outline" className="mr-2 text-xs">
                      {p.status}
                    </Badge>
                    {p.periodo_label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.generated_at ? new Date(p.generated_at).toLocaleDateString("es-AR") : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

function PlanViewer({ plan }: { plan: MonthlyContentPlan }) {
  return (
    <div className="space-y-5">
      {/* Resumen del mes */}
      {plan.resumen_mes?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumen del período</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {plan.resumen_mes.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Mix por red */}
      {plan.mix_por_red?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadencia mensual por red</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {plan.mix_por_red.map((m, i) => (
                <div key={i} className="rounded border bg-card p-3">
                  <div className="text-sm font-semibold capitalize">{m.red}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(m.cadencia).map(([formato, qty]) => (
                      <div key={formato} className="rounded bg-muted px-2 py-1">
                        <div className="text-[10px] uppercase text-muted-foreground">{formato}</div>
                        <div className="font-bold">{qty}</div>
                      </div>
                    ))}
                  </div>
                  {m.notas && <div className="mt-2 text-xs text-muted-foreground">{m.notas}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribución de pilares */}
      {plan.distribucion_pilares?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribución por pilar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.distribucion_pilares.map((p, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{p.pilar}</span>
                    <span className="text-primary font-semibold">{p.porcentaje}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, p.porcentaje))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.justificacion}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Temas destacados */}
      {plan.temas_destacados?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Temas destacados del período</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {plan.temas_destacados.map((t, i) => (
                <li key={i} className="rounded border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{i + 1}. {t.titulo}</span>
                    {t.pilar && (
                      <Badge variant="outline" className="text-[10px]">
                        {t.pilar}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-muted-foreground">{t.descripcion}</div>
                  {t.fecha && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {t.fecha}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Campañas */}
      {plan.campanas?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Campañas / lanzamientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.campanas.map((c, i) => (
                <div key={i} className="rounded border bg-card p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold">{c.nombre}</div>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.piezas_estimadas} piezas · {c.formato_principal}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.fechas} · objetivo: {c.objetivo}
                  </div>
                  <div className="mt-2 text-sm">{c.detalle}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reglas operativas */}
      {plan.reglas_operativas?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reglas operativas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {plan.reglas_operativas.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {plan.kpis_objetivo?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">KPIs objetivo</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {plan.kpis_objetivo.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Notas */}
      {plan.notas && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{plan.notas}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

