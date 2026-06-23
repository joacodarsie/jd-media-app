"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Mail, Phone, ChevronDown, Trash2, Search, Star, FileText } from "lucide-react";
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
import { deleteCandidate } from "@/app/(app)/reclutamiento/actions";

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
}

const POOL_AREAS = AREA_OPTIONS.filter((a) => a.value !== "otro");
const areaLabelShort = (v: string | null) =>
  AREA_OPTIONS.find((a) => a.value === v)?.label ?? v ?? "—";

function scoreColor(n: number | null): string {
  if (n == null) return "bg-muted text-muted-foreground";
  if (n >= 75) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (n >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

export function RecruitmentPoolCandidates({
  poolId,
  candidates,
}: {
  poolId: string;
  candidates: PoolCandidate[];
}) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("todas");
  const [soloCordoba, setSoloCordoba] = useState(false);
  const [minScore, setMinScore] = useState(0);

  // Puntaje según el rol elegido (o el mejor rol si "todas").
  const scoreFor = (c: PoolCandidate): number | null =>
    area === "todas" ? c.fit_score : c.area_scores?.[area] ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates
      .filter((c) => {
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
  }, [candidates, q, area, soloCordoba, minScore]);

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
            <PoolRow key={c.id} c={c} poolId={poolId} score={scoreFor(c)} area={area} />
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
}: {
  c: PoolCandidate;
  poolId: string;
  score: number | null;
  area: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    if (!confirm("¿Borrar este candidato?")) return;
    start(async () => {
      const res = await deleteCandidate(c.id, poolId);
      if ("error" in res) return void toast.error(res.error);
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
            {c.es_cordoba_capital === true && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" /> Córdoba Cap.
              </span>
            )}
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
