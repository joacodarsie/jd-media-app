"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  generateInterviewGuide,
  saveInterview,
  setCandidateFase,
  type CandidateFase,
} from "@/app/(app)/reclutamiento/actions";

export interface PipelineCandidate {
  id: string;
  nombre: string | null;
  fase: CandidateFase;
  fit_score: number | null;
  entrevista_transcript: string | null;
  entrevista_notas: string | null;
  entrevista_analisis: string | null;
}

const FASES: { key: CandidateFase; label: string; emoji: string }[] = [
  { key: "pool", label: "Pool", emoji: "📥" },
  { key: "entrevista", label: "Entrevistado", emoji: "🎙️" },
  { key: "segunda", label: "2ª instancia", emoji: "🔁" },
  { key: "prueba", label: "Prueba paga", emoji: "🧪" },
  { key: "contratado", label: "Contratado", emoji: "✅" },
  { key: "descartado", label: "Descartado", emoji: "🗑️" },
];

const NEXT: Partial<Record<CandidateFase, CandidateFase>> = {
  pool: "entrevista",
  entrevista: "segunda",
  segunda: "prueba",
  prueba: "contratado",
};

const md =
  "space-y-2 text-sm leading-relaxed [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:p-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/40 [&_td]:p-1 [&_ul]:list-disc [&_ul]:pl-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold";

export function RecruitmentPipeline({
  searchId,
  candidates,
  analisisComparativo,
}: {
  searchId: string;
  candidates: PipelineCandidate[];
  analisisComparativo: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [notas, setNotas] = useState("");
  const [guide, setGuide] = useState<string | null>(null);
  const [comparando, setComparando] = useState(false);
  const [comparativo, setComparativo] = useState<string | null>(analisisComparativo);
  const [showComparativo, setShowComparativo] = useState(false);

  const run = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn()));

  function openInterview(c: PipelineCandidate) {
    setOpenId(openId === c.id ? null : c.id);
    setTranscript(c.entrevista_transcript ?? "");
    setNotas(c.entrevista_notas ?? "");
  }

  async function comparar() {
    setComparando(true);
    setShowComparativo(true);
    setComparativo("");
    try {
      const res = await fetch("/api/reclutamiento/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "No se pudo comparar");
        setComparativo(analisisComparativo);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6)) as {
            type: string;
            text?: string;
            analisis?: string;
            error?: string;
          };
          if (evt.type === "delta") {
            full += evt.text ?? "";
            setComparativo(full);
          } else if (evt.type === "done") setComparativo(evt.analisis ?? full);
          else if (evt.type === "error") toast.error(evt.error ?? "Error");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error comparando");
    } finally {
      setComparando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await generateInterviewGuide(searchId);
              if ("error" in r) toast.error(r.error);
              else setGuide(r.guide);
            })
          }
          className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending && !guide ? "Generando…" : "📋 Miniguía de entrevista"}
        </button>
        <button
          type="button"
          disabled={comparando}
          onClick={comparar}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {comparando ? "Comparando…" : "⚖️ Comparar candidatos con IA"}
        </button>
        {comparativo && !showComparativo && (
          <button
            type="button"
            onClick={() => setShowComparativo(true)}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Ver última comparación
          </button>
        )}
      </div>

      {guide && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">📋 Miniguía para la entrevista</h3>
            <button type="button" onClick={() => setGuide(null)} className="text-xs text-muted-foreground">
              cerrar
            </button>
          </div>
          <div className={md}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
          </div>
        </div>
      )}

      {showComparativo && comparativo !== null && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">⚖️ Comparación de candidatos</h3>
            <button
              type="button"
              onClick={() => setShowComparativo(false)}
              className="text-xs text-muted-foreground"
            >
              cerrar
            </button>
          </div>
          <div className={md}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comparativo}</ReactMarkdown>
          </div>
          {comparando && <p className="mt-2 text-xs text-muted-foreground">Analizando…</p>}
        </div>
      )}

      {FASES.map((f) => {
        const enFase = candidates.filter((c) => c.fase === f.key);
        if (enFase.length === 0) return null;
        return (
          <div key={f.key}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {f.emoji} {f.label} · {enFase.length}
            </h3>
            <div className="space-y-1.5">
              {enFase.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.nombre ?? "(sin nombre)"}</span>
                    {c.fit_score != null && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        fit {c.fit_score}
                      </span>
                    )}
                    {c.entrevista_transcript && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        🎙️ entrevista cargada
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openInterview(c)}
                        className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        {c.entrevista_transcript ? "Entrevista" : "+ Entrevista"}
                      </button>
                      {NEXT[c.fase] && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const r = await setCandidateFase(c.id, NEXT[c.fase]!);
                              if ("error" in r) toast.error(r.error);
                              else toast.success(`→ ${FASES.find((x) => x.key === NEXT[c.fase])?.label}`);
                            })
                          }
                          className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                        >
                          Siguiente fase →
                        </button>
                      )}
                      {c.fase !== "descartado" && c.fase !== "contratado" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const r = await setCandidateFase(c.id, "descartado");
                              if ("error" in r) toast.error(r.error);
                            })
                          }
                          className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Descartar
                        </button>
                      )}
                      {c.fase === "descartado" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const r = await setCandidateFase(c.id, "pool");
                              if ("error" in r) toast.error(r.error);
                            })
                          }
                          className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          Restaurar
                        </button>
                      )}
                    </span>
                  </div>

                  {c.entrevista_analisis && openId !== c.id && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Ver análisis de la entrevista
                      </summary>
                      <p className="mt-1 whitespace-pre-line rounded-md bg-muted/40 p-2 text-xs leading-relaxed">
                        {c.entrevista_analisis}
                      </p>
                    </details>
                  )}

                  {openId === c.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Pegá acá la transcripción de la entrevista (Tactiq, notas, etc.)…"
                        rows={6}
                        className="w-full rounded-md border bg-background px-2.5 py-2 text-xs"
                      />
                      <input
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder="Notas tuyas (opcional): expectativa de pago, disponibilidad…"
                        className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const r = await saveInterview({
                                candidateId: c.id,
                                transcript,
                                notas,
                              });
                              if ("error" in r) toast.error(r.error);
                              else {
                                toast.success(
                                  r.analisis
                                    ? "Entrevista guardada y analizada con IA"
                                    : "Entrevista guardada"
                                );
                                setOpenId(null);
                              }
                            })
                          }
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {pending ? "Guardando…" : "Guardar y analizar con IA"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenId(null)}
                          className="rounded-md border px-3 py-1.5 text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
