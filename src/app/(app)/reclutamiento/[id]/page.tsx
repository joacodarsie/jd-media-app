import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecruitmentSearchForm } from "@/components/recruitment-search-form";
import { RecruitmentUploader } from "@/components/recruitment-uploader";
import { RecruitmentGmailImport } from "@/components/recruitment-gmail-import";
import {
  RecruitmentCandidates,
  type Candidate,
} from "@/components/recruitment-candidates";
import {
  RecruitmentPipeline,
  type PipelineCandidate,
} from "@/components/recruitment-pipeline";
import { buildAreaProfiles } from "@/lib/recruitment/area-profile";
import { areaLabel } from "@/lib/recruitment/areas";

export const dynamic = "force-dynamic";

export default async function BusquedaPage({ params }: { params: { id: string } }) {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  const { data: search } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, perfil, ubicacion_pref, estado")
    .eq("id", params.id)
    .maybeSingle();
  if (!search) notFound();
  const s = search as {
    id: string;
    titulo: string;
    area: string | null;
    perfil: string | null;
    ubicacion_pref: string | null;
    estado: string;
  };

  const { data: cand } = await admin
    .from("recruitment_candidates")
    .select(
      "id, nombre, email, telefono, ubicacion, es_cordoba_capital, area, anios_experiencia, skills, educacion, resumen, fortalezas, dudas, fit_score, archivo_nombre"
    )
    .eq("search_id", s.id)
    .order("fit_score", { ascending: false, nullsFirst: false });

  const candidates = (cand ?? []) as Candidate[];

  // Pipeline de selección (fases + entrevistas). Si la migración 0126 no está
  // aplicada, la query falla en silencio y la sección no se muestra.
  const [{ data: pipelineRaw }, { data: searchExtra }] = await Promise.all([
    admin
      .from("recruitment_candidates")
      .select(
        "id, nombre, fase, fit_score, entrevista_transcript, entrevista_notas, entrevista_analisis"
      )
      .eq("search_id", s.id)
      .order("fit_score", { ascending: false, nullsFirst: false }),
    admin
      .from("recruitment_searches")
      .select("analisis_comparativo")
      .eq("id", s.id)
      .maybeSingle(),
  ]);
  const pipelineCandidates = (pipelineRaw ?? []) as PipelineCandidate[];
  const analisisComparativo =
    (searchExtra as { analisis_comparativo?: string | null } | null)
      ?.analisis_comparativo ?? null;

  // ¿Hay casilla de Gmail conectada? (para mostrar "Traer de Gmail")
  const { data: gm } = await admin
    .from("gmail_account")
    .select("email")
    .eq("id", 1)
    .maybeSingle();
  const gmailConnected = !!(gm as { email?: string | null } | null)?.email;

  const areaProfiles = await buildAreaProfiles(admin);

  // Resumen rápido de la búsqueda.
  const total = candidates.length;
  const enCordoba = candidates.filter((c) => c.es_cordoba_capital === true).length;
  const aptos = candidates.filter((c) => (c.fit_score ?? 0) >= 75).length;

  return (
    <div className="space-y-5">
      <Link
        href="/reclutamiento"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Reclutamiento
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{s.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {areaLabel(s.area)} · {s.ubicacion_pref ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecruitmentUploader searchId={s.id} />
          <RecruitmentSearchForm
            mode="edit"
            search={s}
            areaProfiles={areaProfiles}
            trigger={
              <Button variant="outline" size="icon" title="Editar búsqueda">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      {s.perfil && (
        <Card>
          <CardContent className="py-2 text-sm">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Perfil que usa la IA para puntuar
                <span className="font-normal normal-case text-muted-foreground group-open:hidden">
                  ver
                </span>
                <span className="hidden font-normal normal-case text-muted-foreground group-open:inline">
                  ocultar
                </span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{s.perfil}</p>
            </details>
          </CardContent>
        </Card>
      )}

      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Candidatos" value={total} />
          <StatBox label="De Córdoba Cap." value={enCordoba} />
          <StatBox label="Aptitud alta (≥75)" value={aptos} accent />
        </div>
      )}

      {gmailConnected && <RecruitmentGmailImport searchId={s.id} connected />}

      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        💡 Subí los CVs con <b>Cargar CVs (PDF)</b> o <b>traelos de Gmail</b> (filtrá
        por asunto/fecha en la búsqueda). La IA lee cada uno, lo puntúa según el
        perfil y te deja filtrar por Córdoba, experiencia y aptitud.
      </div>

      {pipelineCandidates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Proceso de selección</h2>
            <p className="text-sm text-muted-foreground">
              Fases del proceso: pool → entrevistado → 2ª instancia → prueba
              paga → contratado. Cargá la transcripción de cada entrevista y
              compará candidatos con IA.
            </p>
          </div>
          <RecruitmentPipeline
            searchId={s.id}
            candidates={pipelineCandidates}
            analisisComparativo={analisisComparativo}
          />
        </div>
      )}

      <RecruitmentCandidates searchId={s.id} candidates={candidates} />
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div
        className={
          accent
            ? "text-2xl font-bold tabular-nums text-emerald-600"
            : "text-2xl font-bold tabular-nums"
        }
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
