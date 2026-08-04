"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileUp,
  Loader2,
  Lock,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { MonthlyDiagnosticView } from "@/components/monthly-diagnostic-view";
import { cn } from "@/lib/utils";
import type {
  ClientMonthlyReport,
  MonthlyDiagnosticContent,
} from "@/lib/monthly-diagnostics/schema";
import {
  generarGuionReunion,
  accionesATareas,
  registrarReunion,
  rehacerInformeCliente,
  marcarInformeCompartido,
} from "@/app/(app)/clientes/[id]/reunion/actions";

const AREA_LABEL: Record<string, string> = {
  diseno: "Diseño",
  community: "Community",
  produccion: "Producción",
  paid: "Paid Media",
  estrategia: "Estrategia",
  desarrollo: "Desarrollo",
  otro: "Coordinación",
};

const PRIORIDAD_STYLE: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  baja: "bg-muted text-muted-foreground",
};

type Fase = "idle" | "subiendo" | "generando";

export interface MonthlyMeetingWorkspaceProps {
  clienteId: string;
  clienteNombre: string;
  periodo: string;
  mesLabel: string;
  guion: string | null;
  diagnostico: MonthlyDiagnosticContent | null;
  diagnosticoAt: string | null;
  tasksCreatedAt: string | null;
  tasksCreatedCount: number | null;
  reunionRegistrada: boolean;
  /** Informe amigable que se le manda al cliente. */
  informe: ClientMonthlyReport | null;
  /** Token del portal — con él se arma el link del informe. null si no tiene. */
  portalToken: string | null;
  sharedAt: string | null;
}

export function MonthlyMeetingWorkspace(props: MonthlyMeetingWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [guion, setGuion] = useState(props.guion);
  const [generandoGuion, setGenerandoGuion] = useState(false);

  // Carga de la transcripción: PDF de Tactiq, texto pegado o audio.
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [notas, setNotas] = useState("");
  const [fase, setFase] = useState<Fase>("idle");
  const [progreso, setProgreso] = useState(0);

  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const trabajando = fase !== "idle" || generandoGuion || transcribiendo || pending;

  // ── Guión ──────────────────────────────────────────────────────────────
  async function onGenerarGuion() {
    setGenerandoGuion(true);
    try {
      const res = await generarGuionReunion(props.clienteId, props.periodo);
      if (!res.ok) throw new Error(res.error);
      setGuion(res.data?.texto ?? null);
      toast.success("Guión listo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el guión.");
    } finally {
      setGenerandoGuion(false);
    }
  }

  async function copiarGuion() {
    if (!guion) return;
    try {
      await navigator.clipboard.writeText(guion);
      toast.success("Guión copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  // ── Audio ──────────────────────────────────────────────────────────────
  async function empezarGrabacion() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Tu navegador no permite grabar. Subí el archivo o pegá el texto.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        await transcribir(blob, "reunion.webm");
      };
      recorderRef.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      toast.error("No pudimos acceder al micrófono.");
    }
  }

  function pararGrabacion() {
    recorderRef.current?.stop();
    setGrabando(false);
  }

  async function subirAudio(f: File | undefined) {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error("El audio supera los 25 MB. Si la reunión fue larga, usá el PDF de Tactiq.");
      return;
    }
    await transcribir(f, f.name);
  }

  async function transcribir(blob: Blob, filename: string) {
    setTranscribiendo(true);
    try {
      const form = new FormData();
      form.set("file", blob, filename);
      const res = await fetch("/api/diagnostico/transcribe-audio", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error transcribiendo");
      const t = String(json.text ?? "").trim();
      if (!t) throw new Error("La transcripción salió vacía.");
      setTexto((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t));
      toast.success("Audio transcripto. Revisalo antes de generar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo transcribir el audio.");
    } finally {
      setTranscribiendo(false);
    }
  }

  // ── Diagnóstico ────────────────────────────────────────────────────────
  function elegirPdf(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tiene que ser un PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("El PDF supera los 20 MB.");
      return;
    }
    setFile(f);
  }

  async function onGenerarDiagnostico() {
    let transcript = texto.trim();
    let sourcePdfPath: string | null = null;

    if (!file && transcript.length < 200) {
      toast.error("Subí el PDF de la transcripción o pegá el texto de la reunión.");
      return;
    }

    // 1) Si hay PDF, lo leemos (reusa la ruta del diagnóstico inicial).
    if (file) {
      setFase("subiendo");
      const form = new FormData();
      form.set("file", file);
      form.set("cliente_id", props.clienteId);
      try {
        const res = await fetch("/api/diagnostico/upload-transcript", {
          method: "POST",
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Error subiendo el PDF");
        const delPdf = String(json.transcript_text ?? "").trim();
        transcript = transcript ? `${delPdf}\n\n${transcript}` : delPdf;
        sourcePdfPath = json.source_pdf_path ?? null;
        toast.success(`PDF leído (${Number(json.chars ?? 0).toLocaleString("es-AR")} caracteres).`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error leyendo el PDF.");
        setFase("idle");
        return;
      }
    }

    // 2) Generación con SSE (el gateway corta las respuestas largas a los 60s).
    setFase("generando");
    setProgreso(0);
    try {
      const res = await fetch("/api/reunion-mensual/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: props.clienteId,
          periodo: props.periodo,
          transcript_text: transcript,
          source_pdf_path: sourcePdfPath,
          notas: notas.trim() || null,
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let listo = false;
      let errMsg: string | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
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
              if (evt.type === "progress") {
                setProgreso(typeof evt.chars === "number" ? evt.chars : 0);
              } else if (evt.type === "informe") {
                setProgreso(-2);
              } else if (evt.type === "saving") {
                setProgreso(-1);
              } else if (evt.type === "done") {
                listo = true;
              } else if (evt.type === "error") {
                errMsg = (evt.error as string) ?? "Error generando el diagnóstico.";
              }
            } catch {
              /* línea ignorada */
            }
          }
        }
      }

      if (errMsg) throw new Error(errMsg);
      if (!listo) throw new Error("La generación se cortó antes de terminar.");

      toast.success("Diagnóstico del mes generado.");
      // Reload duro: la página server vuelve a montar con el diagnóstico nuevo
      // y el estado local de este componente no queda trabado.
      window.location.href = `/clientes/${props.clienteId}/reunion?mes=${props.periodo}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generando el diagnóstico.");
      setFase("idle");
    }
  }

  function onPasarATareas() {
    startTransition(async () => {
      const res = await accionesATareas(props.clienteId, props.periodo);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data?.created ?? 0} tareas creadas.`);
      router.refresh();
    });
  }

  // ── Informe del cliente ────────────────────────────────────────────────
  const linkInforme =
    props.portalToken && typeof window !== "undefined"
      ? `${window.location.origin}/c/${props.portalToken}/mes/${props.periodo}`
      : null;

  async function copiarLinkInforme() {
    if (!linkInforme) return;
    try {
      await navigator.clipboard.writeText(linkInforme);
      toast.success("Link copiado. Ya se lo podés mandar.");
      startTransition(async () => {
        await marcarInformeCompartido(props.clienteId, props.periodo);
        router.refresh();
      });
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function onRehacerInforme() {
    startTransition(async () => {
      const res = await rehacerInformeCliente(props.clienteId, props.periodo);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Informe rehecho.");
      router.refresh();
    });
  }

  function onRegistrarReunion() {
    startTransition(async () => {
      const res = await registrarReunion(props.clienteId, props.periodo, notas || null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Reunión registrada.");
      router.refresh();
    });
  }

  const acciones = props.diagnostico?.acciones_proximo_mes ?? [];

  return (
    <div className="space-y-6">
      {/* ── 1. Antes de la reunión: el guión ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" /> Guión de la reunión
              </CardTitle>
              <CardDescription>
                Lo que tenés que llevar al meet de {props.mesLabel}: los números, lo que quedó
                pendiente del mes pasado y qué preguntarle. 20-25 minutos.
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              {guion && (
                <Button variant="outline" size="sm" onClick={copiarGuion} disabled={trabajando}>
                  <Copy className="mr-1 h-4 w-4" /> Copiar
                </Button>
              )}
              <Button size="sm" onClick={onGenerarGuion} disabled={trabajando}>
                {generandoGuion ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-4 w-4" />
                )}
                {guion ? "Rehacer guión" : "Armar guión"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {guion ? (
            <div className="rounded-lg border bg-card/40 p-4">
              <Markdown>{guion}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay guión de este mes. Dale a &ldquo;Armar guión&rdquo; y la IA lo arma
              con las métricas reales de {props.clienteNombre} y lo que salió de la reunión
              anterior.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Después de la reunión: la transcripción ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Diagnóstico de {props.mesLabel}
          </CardTitle>
          <CardDescription>
            Cargá la transcripción del meet y la IA arma la foto del mes: qué funcionó, qué le
            molestó, qué necesita y si cambió el público al que le habla la marca.
            {props.diagnostico && " Generar de nuevo pisa el diagnóstico de este mes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PDF */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              Transcripción en PDF (Tactiq)
            </div>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition hover:bg-muted/40",
                file && "border-solid bg-muted/30"
              )}
            >
              <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {file ? file.name : "Elegir el PDF de la transcripción"}
              </span>
              {file && (
                <span
                  role="button"
                  tabIndex={0}
                  className="shrink-0 text-xs text-muted-foreground underline"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setFile(null);
                  }}
                >
                  quitar
                </span>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={trabajando}
                onChange={(e) => elegirPdf(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* Texto + audio */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                O pegá el texto de la reunión
              </span>
              <div className="flex gap-2">
                {grabando ? (
                  <Button variant="destructive" size="sm" onClick={pararGrabacion}>
                    <Square className="mr-1 h-3.5 w-3.5" /> Parar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={empezarGrabacion}
                    disabled={trabajando}
                  >
                    {transcribiendo ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mic className="mr-1 h-3.5 w-3.5" />
                    )}
                    Grabar
                  </Button>
                )}
                <label>
                  <Button variant="outline" size="sm" asChild disabled={trabajando}>
                    <span className="cursor-pointer">
                      <Upload className="mr-1 h-3.5 w-3.5" /> Subir audio
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    disabled={trabajando}
                    onChange={(e) => subirAudio(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={trabajando}
              rows={6}
              placeholder="Pegá acá la transcripción, o grabá/subí el audio de la reunión y se transcribe solo."
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              Notas tuyas (opcional) — lo que no quedó en la transcripción
            </div>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={trabajando}
              rows={2}
              placeholder="Ej: se lo notó incómodo cuando hablamos de los tiempos de entrega."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onGenerarDiagnostico} disabled={trabajando}>
              {fase === "idle" ? (
                <Sparkles className="mr-1 h-4 w-4" />
              ) : (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {props.diagnostico ? "Regenerar diagnóstico" : "Generar diagnóstico del mes"}
            </Button>
            {!props.reunionRegistrada && (
              <Button variant="ghost" size="sm" onClick={onRegistrarReunion} disabled={trabajando}>
                Solo registrar que la reunión se hizo
              </Button>
            )}
            {fase === "subiendo" && (
              <span className="text-xs text-muted-foreground">Leyendo el PDF…</span>
            )}
            {fase === "generando" && (
              <span className="text-xs text-muted-foreground">
                {progreso === -1
                  ? "Guardando…"
                  : progreso === -2
                    ? "Escribiendo el informe para el cliente…"
                    : `Analizando la reunión… ${progreso.toLocaleString("es-AR")} caracteres`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. El informe que se le manda al cliente ── */}
      {props.diagnostico && (
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4" /> Informe para el cliente
                </CardTitle>
                <CardDescription>
                  La versión amigable del análisis, sin nada interno. Se abre con el mismo link
                  del portal que ya tiene {props.clienteNombre}.
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {props.informe && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRehacerInforme}
                    disabled={trabajando}
                  >
                    {pending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-4 w-4" />
                    )}
                    Rehacer texto
                  </Button>
                )}
                {props.informe && linkInforme && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={linkInforme} target="_blank" rel="noreferrer">
                        <Eye className="mr-1 h-4 w-4" /> Verlo
                      </a>
                    </Button>
                    <Button size="sm" onClick={copiarLinkInforme} disabled={trabajando}>
                      <Copy className="mr-1 h-4 w-4" /> Copiar link
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!props.informe ? (
              <div className="rounded-md border border-dashed p-3 text-muted-foreground">
                El informe no se pudo armar automáticamente. Dale a{" "}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onRehacerInforme}
                  disabled={trabajando}
                >
                  rehacer texto
                </Button>{" "}
                para reintentar.
              </div>
            ) : !props.portalToken ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                El informe está listo, pero {props.clienteNombre} todavía no tiene link de portal.
                Generalo desde la ficha del cliente (sección &ldquo;Portal&rdquo;) y el informe
                queda accesible.
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-card/40 p-3">
                  <div className="font-medium">{props.informe.titular}</div>
                  {props.informe.apertura && (
                    <p className="mt-1 text-muted-foreground">{props.informe.apertura}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {props.informe.numeros.length > 0 && (
                      <span>{props.informe.numeros.length} números destacados</span>
                    )}
                    <span>{props.informe.logros.length} logros</span>
                    {props.informe.te_escuchamos.length > 0 && (
                      <span>{props.informe.te_escuchamos.length} planteos suyos respondidos</span>
                    )}
                    <span>{props.informe.proximo_mes.length} acciones del mes que viene</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Revisalo con &ldquo;Verlo&rdquo; antes de mandarlo.
                  {props.sharedAt && " Ya lo compartiste una vez."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 4. El diagnóstico interno del mes ── */}
      {props.diagnostico && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Solo para el equipo
          </div>
          {props.diagnosticoAt && (
            <p className="text-xs text-muted-foreground">
              Generado el{" "}
              {new Date(props.diagnosticoAt).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          <MonthlyDiagnosticView content={props.diagnostico} mesLabel={props.mesLabel} />

          {acciones.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Acciones para el mes que viene</CardTitle>
                    <CardDescription>
                      {props.tasksCreatedAt
                        ? `Ya se crearon ${props.tasksCreatedCount ?? 0} tareas con esto.`
                        : "Pasalas a tareas del equipo con un botón."}
                    </CardDescription>
                  </div>
                  {!props.tasksCreatedAt && (
                    <Button size="sm" onClick={onPasarATareas} disabled={trabajando}>
                      {pending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                      )}
                      Pasar a tareas
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {acciones.map((a, i) => (
                  <div key={i} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.titulo}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                          PRIORIDAD_STYLE[a.prioridad] ?? PRIORIDAD_STYLE.media
                        )}
                      >
                        {a.prioridad}
                      </span>
                      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {AREA_LABEL[a.area_sugerida] ?? a.area_sugerida}
                      </span>
                    </div>
                    {a.descripcion && (
                      <p className="mt-1 text-muted-foreground">{a.descripcion}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
