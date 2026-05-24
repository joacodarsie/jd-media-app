"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  CheckCircle2,
  ListChecks,
  History,
  Loader2,
  Save,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  saveDiagnosticDraft,
  approveDiagnostic,
  convertPlanToTasks,
} from "@/app/(app)/clientes/[id]/diagnostico/actions";
import type {
  DiagnosticContent,
  DiagnosticRow,
  ActionItem,
} from "@/lib/diagnostics/schema";

interface Props {
  clienteId: string;
  clienteNombre: string;
  active: DiagnosticRow | null;
  history: DiagnosticRow[];
}

type Phase = "idle" | "uploading" | "generating" | "draft" | "approved";

export function DiagnosticWorkspace({ clienteId, clienteNombre, active, history }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialPhase: Phase = active
    ? active.status === "draft"
      ? "draft"
      : "approved"
    : "idle";

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [current, setCurrent] = useState<DiagnosticRow | null>(active);
  const [content, setContent] = useState<DiagnosticContent | null>(active?.content ?? null);

  // ── Upload de PDF ─────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);

  async function handleUploadAndGenerate() {
    if (!file) {
      toast.error("Subí el PDF de la transcripción primero.");
      return;
    }
    setPhase("uploading");

    // 1) Upload + extracción.
    const form = new FormData();
    form.set("file", file);
    form.set("cliente_id", clienteId);

    let transcript_text = "";
    let source_pdf_path: string | null = null;
    try {
      const res = await fetch("/api/diagnostico/upload-transcript", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error subiendo el PDF");
      transcript_text = json.transcript_text;
      source_pdf_path = json.source_pdf_path;
      toast.success(`PDF leído (${json.chars.toLocaleString()} caracteres).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
      setPhase("idle");
      return;
    }

    // 2) Generación IA.
    setPhase("generating");
    try {
      const res = await fetch("/api/diagnostico/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, transcript_text, source_pdf_path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error generando");
      toast.success(`Diagnóstico v${json.version} generado. Revisalo y aprobá.`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
      setPhase("idle");
    }
  }

  // ── Edición del draft ─────────────────────────────────────────────
  function updateContent(patch: Partial<DiagnosticContent>) {
    setContent((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function handleSave() {
    if (!current || !content) return;
    startTransition(async () => {
      const r = await saveDiagnosticDraft(current.id, content);
      if (!r.ok) toast.error(r.error);
      else toast.success("Cambios guardados.");
    });
  }

  function handleApprove() {
    if (!current || !content) return;
    if (!confirm("¿Aprobar este diagnóstico? Quedará disponible para el cliente y el equipo.")) return;
    startTransition(async () => {
      // Guardar antes de aprobar para no perder cambios.
      await saveDiagnosticDraft(current.id, content);
      const r = await approveDiagnostic(current.id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Diagnóstico aprobado.");
        router.refresh();
      }
    });
  }

  function handleConvertTasks() {
    if (!current) return;
    if (!confirm("¿Crear tareas para todas las acciones del plan?")) return;
    startTransition(async () => {
      const r = await convertPlanToTasks(current.id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Se crearon ${r.data?.created ?? 0} tareas.`);
        router.refresh();
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────
  if (phase === "idle" && !current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generar diagnóstico inicial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Subí el PDF de la transcripción del meet de onboarding (Tactiq de Google Meet).
            La IA va a analizarla y generar las 14 secciones del informe estratégico para{" "}
            <strong>{clienteNombre}</strong>.
          </p>
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={handleUploadAndGenerate} disabled={!file || phase !== "idle"}>
            <Upload className="mr-1 h-4 w-4" /> Subir y generar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "uploading" || phase === "generating") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {phase === "uploading"
              ? "Leyendo el PDF y extrayendo texto…"
              : "Generando diagnóstico con IA (puede tardar 30-60 segundos)…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!current || !content) return null;

  const isDraft = current.status === "draft";
  const isApproved = current.status === "approved";

  return (
    <div className="space-y-6">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant={isApproved ? "default" : "secondary"}>
            v{current.version} · {current.status}
          </Badge>
          {current.generated_at && (
            <span className="text-xs text-muted-foreground">
              Generado {new Date(current.generated_at).toLocaleDateString("es-AR")}
            </span>
          )}
          {history.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <History className="h-3 w-3" /> {history.length} versiones
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={pending}>
                <Save className="mr-1 h-4 w-4" /> Guardar
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={pending}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
              </Button>
            </>
          )}
          {isApproved && !current.tasks_created_at && (
            <Button size="sm" variant="outline" onClick={handleConvertTasks} disabled={pending}>
              <ListChecks className="mr-1 h-4 w-4" /> Convertir plan a tareas
            </Button>
          )}
          {isApproved && current.tasks_created_at && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> {current.tasks_created_count} tareas creadas
            </span>
          )}
        </div>
      </div>

      {/* Renderizamos las secciones — vista de solo lectura si aprobado, editable si draft */}
      <DiagnosticEditor content={content} editable={isDraft} onChange={updateContent} />

      {isDraft && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Este es un <strong>draft generado por IA</strong>. Revisalo, ajustá lo que haga falta y aprobalo.
            Una vez aprobado vas a poder exportar el PDF y convertir el plan en tareas.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Editor por bloques — un componente por sección
// ─────────────────────────────────────────────────────────────────────

function DiagnosticEditor({
  content,
  editable,
  onChange,
}: {
  content: DiagnosticContent;
  editable: boolean;
  onChange: (patch: Partial<DiagnosticContent>) => void;
}) {
  return (
    <div className="space-y-5">
      <Section title="1. Resumen ejecutivo">
        <StringListEditor
          items={content.resumen_ejecutivo.bullets}
          editable={editable}
          onChange={(bullets) => onChange({ resumen_ejecutivo: { bullets } })}
          placeholder="Punto crítico…"
        />
      </Section>

      <Section title="2. Contexto del negocio">
        <Field label="Qué es" editable={editable} value={content.contexto.que_es}
          onChange={(v) => onChange({ contexto: { ...content.contexto, que_es: v } })} />
        <Field label="Etapa" editable={editable} value={content.contexto.etapa}
          onChange={(v) => onChange({ contexto: { ...content.contexto, etapa: v as DiagnosticContent["contexto"]["etapa"] } })} />
        <Field label="Historia" editable={editable} value={content.contexto.historia} multiline
          onChange={(v) => onChange({ contexto: { ...content.contexto, historia: v } })} />
        <Field label="Brecha actual" editable={editable} value={content.contexto.brecha_actual} multiline
          onChange={(v) => onChange({ contexto: { ...content.contexto, brecha_actual: v } })} />
      </Section>

      <Section title="3. Modelo de negocio">
        <ReadOnlyBlock>
          <div className="space-y-2 text-sm">
            <div><strong>Productos/servicios:</strong> {content.modelo_negocio.productos_servicios.map((p) => p.nombre + (p.ticket ? ` (${p.ticket})` : "")).join(", ")}</div>
            <div><strong>Modalidad:</strong> {content.modelo_negocio.modalidad}</div>
            <div><strong>Canales:</strong> {content.modelo_negocio.canales_actuales.join(", ")}</div>
            <div><strong>Cómo se vende hoy:</strong> {content.modelo_negocio.como_se_vende_hoy.join(", ")}</div>
            <div><strong>Atiende:</strong> {content.modelo_negocio.operativo.quien_atiende}</div>
            <div><strong>Horarios:</strong> {content.modelo_negocio.operativo.horarios}</div>
          </div>
        </ReadOnlyBlock>
      </Section>

      <Section title="4. Público objetivo">
        <Field label="Insight clave" editable={editable} value={content.publico_objetivo.insight_clave} multiline
          onChange={(v) => onChange({ publico_objetivo: { ...content.publico_objetivo, insight_clave: v } })} />
        <Field label="Anti-público" editable={editable} value={content.publico_objetivo.anti_publico} multiline
          onChange={(v) => onChange({ publico_objetivo: { ...content.publico_objetivo, anti_publico: v } })} />
        <div className="mt-3">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Segmentos</div>
          <div className="grid gap-2 md:grid-cols-2">
            {content.publico_objetivo.segmentos.map((s, i) => (
              <div key={i} className="rounded border bg-card p-3 text-sm">
                <div className="font-medium">{s.nombre}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.perfil}</div>
                <div className="mt-2 text-xs"><strong>Plan típico:</strong> {s.plan_tipico}</div>
                <div className="text-xs"><strong>Valor:</strong> {s.valor}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="5. Marca e identidad">
        <ReadOnlyBlock>
          <div className="space-y-2 text-sm">
            <div><strong>Personalidad:</strong> {content.marca.personalidad.join(", ")}</div>
            <div><strong>Percepción deseada:</strong> {content.marca.percepcion_deseada}</div>
            <div><strong>Tono:</strong> {content.marca.tono_voz.registro}{content.marca.tono_voz.humor ? " · con humor" : ""}</div>
            {content.marca.tono_voz.frases_representativas.length > 0 && (
              <div><strong>Frases:</strong> {content.marca.tono_voz.frases_representativas.map((f) => `"${f}"`).join(", ")}</div>
            )}
          </div>
        </ReadOnlyBlock>
      </Section>

      <Section title="6. Diferenciales">
        <NumberedList items={content.diferenciales.map((d) => ({ titulo: d.titulo, descripcion: d.descripcion }))} />
      </Section>

      <Section title="7. Problemas detectados">
        <NumberedList items={content.problemas.map((p) => ({ titulo: p.titulo, descripcion: p.descripcion, extra: p.evidencia ? `Evidencia: ${p.evidencia}` : undefined }))} />
      </Section>

      <Section title="8. Competencia y referencias">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Competidores</div>
            {content.competencia_referencias.competidores.map((c, i) => (
              <div key={i} className="mb-2 rounded border bg-card p-3 text-sm">
                <div className="font-medium">{c.nombre}</div>
                <div className="mt-1 text-xs"><strong>+</strong> {c.fortalezas}</div>
                <div className="text-xs"><strong>−</strong> {c.debilidades}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Marcas inspo</div>
            {content.competencia_referencias.inspo.map((m, i) => (
              <div key={i} className="mb-2 rounded border bg-card p-3 text-sm">
                <div className="font-medium">{m.nombre}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.que_tomar}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="9. Objetivos del primer trimestre">
        <NumberedList items={content.objetivos_trimestre.map((o) => ({ titulo: o.titulo, descripcion: o.descripcion }))} />
      </Section>

      <Section title="10. Pilares de contenido">
        <div className="grid gap-3 md:grid-cols-2">
          {content.pilares_contenido.map((p, i) => (
            <div key={i} className="rounded border bg-card p-3 text-sm">
              <div className="font-medium">{i + 1}. {p.nombre}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.descripcion}</div>
              {p.ejemplos.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                  {p.ejemplos.map((e, j) => <li key={j}>{e}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="11. Plan de acción">
        <PlanAccionEditor
          items={content.plan_accion}
          editable={editable}
          onChange={(plan_accion) => onChange({ plan_accion })}
        />
      </Section>

      <Section title="12. Recursos y limitaciones">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Lo que aporta el cliente</div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {content.recursos_limitaciones.aporta_cliente.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Líneas rojas</div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {content.recursos_limitaciones.lineas_rojas.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="13. Próximos pasos">
        <ul className="list-inside list-decimal space-y-1 text-sm">
          {content.proximos_pasos.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ReadOnlyBlock({ children }: { children: React.ReactNode }) {
  return <div className="rounded bg-muted/40 p-3">{children}</div>;
}

function Field({
  label,
  value,
  editable,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  multiline?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">{label}</label>
      {editable ? (
        multiline ? (
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <div className="text-sm">{value}</div>
      )}
    </div>
  );
}

function StringListEditor({
  items,
  editable,
  onChange,
  placeholder,
}: {
  items: string[];
  editable: boolean;
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  if (!editable) {
    return (
      <ul className="list-inside list-disc space-y-1 text-sm">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Textarea
            rows={2}
            value={it}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        + Agregar
      </Button>
    </div>
  );
}

function NumberedList({
  items,
}: {
  items: { titulo: string; descripcion: string; extra?: string }[];
}) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="rounded border bg-card p-3 text-sm">
          <div className="font-medium">{i + 1}. {it.titulo}</div>
          <div className="mt-1 text-muted-foreground">{it.descripcion}</div>
          {it.extra && <div className="mt-1 text-xs italic text-muted-foreground">{it.extra}</div>}
        </li>
      ))}
    </ol>
  );
}

const AREA_LABEL: Record<string, string> = {
  diseno: "Diseño",
  community: "Community",
  produccion: "Producción",
  paid: "Paid Media",
  estrategia: "Estrategia",
  desarrollo: "Desarrollo",
  otro: "Otro",
};
const PRI_COLOR: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  baja: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

function PlanAccionEditor({
  items,
  editable,
  onChange,
}: {
  items: ActionItem[];
  editable: boolean;
  onChange: (items: ActionItem[]) => void;
}) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="rounded border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{i + 1}.</span>
              {editable ? (
                <Input
                  className="h-7"
                  value={it.titulo}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, titulo: e.target.value };
                    onChange(next);
                  }}
                />
              ) : (
                <span className="font-medium">{it.titulo}</span>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{AREA_LABEL[it.area_sugerida] ?? it.area_sugerida}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${PRI_COLOR[it.prioridad]}`}>{it.prioridad}</span>
            </div>
          </div>
          {editable ? (
            <Textarea
              className="mt-2"
              rows={2}
              value={it.descripcion}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...it, descripcion: e.target.value };
                onChange(next);
              }}
            />
          ) : (
            <div className="mt-1 text-muted-foreground">{it.descripcion}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
