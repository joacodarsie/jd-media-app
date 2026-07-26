"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MapPin,
  Mail,
  Phone,
  ChevronDown,
  Trash2,
  Search,
  Star,
  FileText,
  Users,
  X,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AREA_OPTIONS } from "@/lib/recruitment/areas";
import {
  deleteCandidate,
  setCandidateFase,
  setCandidateGrupos,
  saveInterview,
  type CandidateFase,
} from "@/app/(app)/reclutamiento/actions";

export interface PoolCandidate {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  ubicacion: string | null;
  es_cordoba_capital: boolean | null;
  area: string | null;
  anios_experiencia: number | null;
  skills: string[];
  educacion: string | null;
  resumen: string | null;
  fortalezas: string[];
  dudas: string[];
  fit_score: number | null;
  area_scores: Record<string, number>;
  archivo_nombre: string | null;
  fase: CandidateFase;
  entrevista_transcript: string | null;
  entrevista_notas: string | null;
  entrevista_analisis: string | null;
  grupos: string[];
}

const POOL_AREAS = AREA_OPTIONS.filter((a) => a.value !== "otro");
const areaLabelShort = (v: string | null) =>
  AREA_OPTIONS.find((a) => a.value === v)?.label ?? v ?? "—";

// Fases del proceso de selección. El "pool" es el estado por defecto (sin tocar).
const FASES: {
  key: CandidateFase;
  label: string;
  emoji: string;
  chip: string;
}[] = [
  { key: "pool", label: "Sin tocar", emoji: "📥", chip: "bg-muted text-muted-foreground" },
  { key: "entrevista", label: "Entrevistado", emoji: "🎙️", chip: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { key: "segunda", label: "2ª instancia", emoji: "🔁", chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  { key: "prueba", label: "Prueba paga", emoji: "🧪", chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { key: "contratado", label: "Contratado", emoji: "✅", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { key: "descartado", label: "Descartado", emoji: "🗑️", chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
];
const FASE = (k: CandidateFase) => FASES.find((f) => f.key === k)!;

// A qué fase pasa al tocar "Siguiente fase →".
const NEXT: Partial<Record<CandidateFase, CandidateFase>> = {
  pool: "entrevista",
  entrevista: "segunda",
  segunda: "prueba",
  prueba: "contratado",
};

function scoreColor(n: number | null): string {
  if (n == null) return "bg-muted text-muted-foreground";
  if (n >= 75) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (n >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

const GRUPO_TODOS = "__todos__";
const GRUPO_SIN = "__sin__";

export function RecruitmentPoolCandidates({
  poolId,
  candidates,
  allGrupos,
  gruposEnabled,
}: {
  poolId: string;
  candidates: PoolCandidate[];
  allGrupos: string[];
  gruposEnabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("todas");
  const [soloCordoba, setSoloCordoba] = useState(false);
  const [minScore, setMinScore] = useState(0);
  // Por defecto ocultamos los descartados para que el pool quede limpio.
  const [fase, setFase] = useState<"activos" | "todos" | CandidateFase>("activos");
  const [grupo, setGrupo] = useState<string>(GRUPO_TODOS);

  // Puntaje según el rol elegido (o el mejor rol si "todas").
  const scoreFor = (c: PoolCandidate): number | null =>
    area === "todas" ? c.fit_score : c.area_scores?.[area] ?? null;

  const faseMatch = (c: PoolCandidate) => {
    if (fase === "todos") return true;
    if (fase === "activos") return c.fase !== "descartado";
    return c.fase === fase;
  };

  const grupoMatch = (c: PoolCandidate) => {
    if (grupo === GRUPO_TODOS) return true;
    if (grupo === GRUPO_SIN) return (c.grupos ?? []).length === 0;
    return (c.grupos ?? []).includes(grupo);
  };

  // Conteo por fase (dentro del rol/ubicación elegidos, sin el filtro de fase),
  // para el mini-resumen del proceso.
  const faseCounts = useMemo(() => {
    const base = candidates.filter((c) => {
      if (soloCordoba && c.es_cordoba_capital !== true) return false;
      if (minScore > 0 && (scoreFor(c) ?? 0) < minScore) return false;
      return true;
    });
    const m: Record<string, number> = {};
    for (const c of base) m[c.fase] = (m[c.fase] ?? 0) + 1;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, area, soloCordoba, minScore]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates
      .filter((c) => {
        if (!faseMatch(c)) return false;
        if (!grupoMatch(c)) return false;
        if (soloCordoba && c.es_cordoba_capital !== true) return false;
        if (minScore > 0 && (scoreFor(c) ?? 0) < minScore) return false;
        if (needle) {
          const hay = [c.nombre, c.ubicacion, c.area, c.educacion, c.resumen, ...(c.skills ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => (scoreFor(b) ?? 0) - (scoreFor(a) ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, q, area, soloCordoba, minScore, fase, grupo]);

  const enProceso = FASES.filter(
    (f) => f.key !== "pool" && (faseCounts[f.key] ?? 0) > 0
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[210px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los roles (mejor aptitud)</SelectItem>
            {POOL_AREAS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                Mejores para {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fase} onValueChange={(v) => setFase(v as typeof fase)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">En proceso (sin descartados)</SelectItem>
            <SelectItem value="todos">Todas las fases</SelectItem>
            {FASES.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.emoji} {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {gruposEnabled && allGrupos.length > 0 && (
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GRUPO_TODOS}>Todos los grupos</SelectItem>
              <SelectItem value={GRUPO_SIN}>Sin grupo</SelectItem>
              {allGrupos.map((g) => (
                <SelectItem key={g} value={g}>
                  👥 {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative min-w-44 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, skill, ubicación…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSoloCordoba((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            soloCordoba
              ? "border-primary bg-primary/10 text-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <MapPin className="h-3.5 w-3.5" /> Solo Córdoba Capital
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Aptitud mín.
          <input
            type="number"
            min={0}
            max={100}
            value={minScore || ""}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
            className="h-8 w-16 rounded-md border bg-background px-2 text-sm"
          />
        </label>
      </div>

      {/* Mini-resumen del proceso: chips clickeables por fase. */}
      {enProceso.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">En proceso:</span>
          {enProceso.map((f) => (
            <button
              key={f.key}
              onClick={() => setFase(fase === f.key ? "activos" : f.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-opacity",
                f.chip,
                fase !== f.key && fase !== "todos" && fase !== "activos" && "opacity-50"
              )}
            >
              {f.emoji} {f.label} · {faseCounts[f.key]}
            </button>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {filtered.length} de {candidates.length} candidatos
        {area !== "todas" && ` · ordenados por aptitud para ${areaLabelShort(area)}`}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {candidates.length === 0
            ? "Todavía no hay CVs analizados. Tocá “Analizar todo”."
            : "Ningún candidato con esos filtros."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <PoolRow
              key={c.id}
              c={c}
              poolId={poolId}
              score={scoreFor(c)}
              area={area}
              allGrupos={allGrupos}
              gruposEnabled={gruposEnabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PoolRow({
  c,
  poolId,
  score,
  area,
  allGrupos,
  gruposEnabled,
}: {
  c: PoolCandidate;
  poolId: string;
  score: number | null;
  area: string;
  allGrupos: string[];
  gruposEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState(false);
  const [transcript, setTranscript] = useState(c.entrevista_transcript ?? "");
  const [notas, setNotas] = useState(c.entrevista_notas ?? "");
  const [grupos, setGrupos] = useState<string[]>(c.grupos ?? []);
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const faseInfo = FASE(c.fase);
  const next = NEXT[c.fase];

  function saveGrupos(nextGrupos: string[]) {
    const prev = grupos;
    setGrupos(nextGrupos); // optimista
    run(async () => {
      const res = await setCandidateGrupos(c.id, nextGrupos);
      if ("error" in res) {
        setGrupos(prev);
        return void toast.error(res.error);
      }
      router.refresh();
    });
  }

  function addGrupo(name: string) {
    const g = name.trim();
    if (!g || grupos.includes(g)) {
      setNuevoGrupo("");
      return;
    }
    saveGrupos([...grupos, g]);
    setNuevoGrupo("");
  }

  function remove() {
    if (!confirm("¿Borrar este candidato?")) return;
    run(async () => {
      const res = await deleteCandidate(c.id, poolId);
      if ("error" in res) return void toast.error(res.error);
      router.refresh();
    });
  }

  function moveTo(f: CandidateFase, okMsg?: string) {
    run(async () => {
      const res = await setCandidateFase(c.id, f);
      if ("error" in res) return void toast.error(res.error);
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  function storeInterview() {
    run(async () => {
      const res = await saveInterview({ candidateId: c.id, transcript, notas });
      if ("error" in res) return void toast.error(res.error);
      toast.success(res.analisis ? "Entrevista guardada y analizada con IA" : "Entrevista guardada");
      // Si estaba sin tocar, al cargar la entrevista lo pasamos a "Entrevistado".
      if (c.fase === "pool") {
        const r2 = await setCandidateFase(c.id, "entrevista");
        if ("error" in r2) toast.error(r2.error);
      }
      setEditingInterview(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border bg-card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-sm font-bold tabular-nums",
            scoreColor(score)
          )}
          title={area === "todas" ? "Aptitud para su mejor rol" : `Aptitud para ${areaLabelShort(area)}`}
        >
          {score ?? "—"}
          <span className="text-[8px] font-medium uppercase opacity-70">apto</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold">{c.nombre ?? c.archivo_nombre ?? "Sin nombre"}</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {areaLabelShort(c.area)}
            </span>
            {c.fase !== "pool" && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", faseInfo.chip)}>
                {faseInfo.emoji} {faseInfo.label}
              </span>
            )}
            {c.es_cordoba_capital === true && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" /> Córdoba Cap.
              </span>
            )}
            {grupos.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              >
                <Users className="h-2.5 w-2.5" /> {g}
              </span>
            ))}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[c.ubicacion, c.anios_experiencia != null ? `${c.anios_experiencia} años exp.` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          {/* Acciones del proceso: entrevista, siguiente fase, descartar. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditingInterview((v) => !v)}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              {c.entrevista_transcript ? "🎙️ Entrevista" : "+ Entrevista"}
            </button>
            {next && (
              <button
                type="button"
                disabled={pending}
                onClick={() => moveTo(next, `→ ${FASE(next).label}`)}
                className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                Siguiente fase →
              </button>
            )}
            {c.fase !== "descartado" && c.fase !== "contratado" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => moveTo("descartado")}
                className="rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive"
              >
                Descartar
              </button>
            )}
            {c.fase === "descartado" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => moveTo("pool", "Restaurado al pool")}
                className="rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                Restaurar
              </button>
            )}
          </div>

          {/* Grupos: shortlists con nombre que armás marcando gente del pool. */}
          {gruposEnabled && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Grupos:
              </span>
              {grupos.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-100 py-0.5 pl-2 pr-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  {g}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => saveGrupos(grupos.filter((x) => x !== g))}
                    className="rounded-full p-0.5 hover:bg-indigo-200 disabled:opacity-50 dark:hover:bg-indigo-900"
                    aria-label={`Sacar de ${g}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                list={`grupos-${c.id}`}
                value={nuevoGrupo}
                onChange={(e) => setNuevoGrupo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGrupo(nuevoGrupo);
                  }
                }}
                placeholder="Agregar a grupo…"
                className="h-7 w-40 rounded-md border bg-background px-2 text-xs"
                maxLength={40}
              />
              <datalist id={`grupos-${c.id}`}>
                {allGrupos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              {nuevoGrupo.trim() && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => addGrupo(nuevoGrupo)}
                  className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              )}
            </div>
          )}

          {/* Editor de entrevista (transcripción + notas → análisis IA). */}
          {editingInterview && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Pegá la transcripción de la entrevista (Tactiq, notas, etc.)…"
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
                  onClick={storeInterview}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Guardando…" : "Guardar y analizar con IA"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInterview(false)}
                  className="rounded-md border px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {c.entrevista_analisis && !editingInterview && (
            <details className="rounded-md bg-muted/30 px-2.5 py-1.5">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Ver análisis de la entrevista (IA)
              </summary>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">
                {c.entrevista_analisis}
              </p>
            </details>
          )}

          {c.resumen && <p className="text-muted-foreground">{c.resumen}</p>}

          {/* Puntaje por área */}
          <div className="flex flex-wrap gap-1.5">
            {POOL_AREAS.map((a) => {
              const s = c.area_scores?.[a.value];
              if (s == null) return null;
              return (
                <span
                  key={a.value}
                  className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", scoreColor(s))}
                  title={a.label}
                >
                  {a.label}: {s}
                </span>
              );
            })}
          </div>

          {c.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {c.skills.map((s, i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {c.fortalezas.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <Star className="h-3 w-3" /> Fortalezas
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {c.fortalezas.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.dudas.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  A revisar
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {c.dudas.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {c.educacion && (
            <div className="text-xs">
              <span className="text-muted-foreground">Formación: </span>
              {c.educacion}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-xs">
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </a>
            )}
            {c.telefono && (
              <a
                href={`https://wa.me/${c.telefono.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> {c.telefono}
              </a>
            )}
            {c.archivo_nombre && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {c.archivo_nombre}
              </span>
            )}
            <button
              onClick={remove}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
