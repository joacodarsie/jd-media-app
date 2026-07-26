import Link from "next/link";
import { Suspense } from "react";
import { Users, ArrowRight, Briefcase } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { RecruitmentSearchForm } from "@/components/recruitment-search-form";
import { RecruitmentGmailConnection } from "@/components/recruitment-gmail-connection";
import { RecruitmentPoolImport } from "@/components/recruitment-pool-import";
import {
  RecruitmentPoolCandidates,
  type PoolCandidate,
} from "@/components/recruitment-pool-candidates";
import { buildAreaProfiles } from "@/lib/recruitment/area-profile";
import { areaLabel } from "@/lib/recruitment/areas";
import { getOrCreatePoolSearch, POOL_TITULO } from "@/lib/recruitment/pool";

export const dynamic = "force-dynamic";

const POOL_FIELDS =
  "id, nombre, email, telefono, ubicacion, es_cordoba_capital, area, anios_experiencia, skills, educacion, resumen, fortalezas, dudas, fit_score, area_scores, archivo_nombre, fase, entrevista_transcript, entrevista_notas, entrevista_analisis, grupos";
// Sin la columna `grupos` (migración 0127 no aplicada) degradamos a este set.
const POOL_FIELDS_NO_GRUPOS = POOL_FIELDS.replace(", grupos", "");

export default async function ReclutamientoPage() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  // El Pool de talento es el corazón de Reclutamiento: todos los CVs, filtrables
  // por rol/ubicación/fase, con el proceso de selección adentro.
  let poolId: string;
  try {
    poolId = await getOrCreatePoolSearch(admin);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "42703" || code === "42P01") return <MigrationNotice />;
    throw e;
  }

  // Candidatos del pool. Degradamos en cascada si faltan migraciones: primero
  // con grupos (0127), si no con fases (0126), y si tampoco, el set básico.
  let candidates: PoolCandidate[] = [];
  let gruposEnabled = true;
  {
    const q = () =>
      admin
        .from("recruitment_candidates")
        .select(POOL_FIELDS)
        .eq("search_id", poolId)
        .order("fit_score", { ascending: false, nullsFirst: false });
    const { data, error } = await q();
    if (error && (error as { code?: string }).code === "42703") {
      gruposEnabled = false;
      const { data: noGrupos, error: e2 } = await admin
        .from("recruitment_candidates")
        .select(POOL_FIELDS_NO_GRUPOS)
        .eq("search_id", poolId)
        .order("fit_score", { ascending: false, nullsFirst: false });
      if (e2 && (e2 as { code?: string }).code === "42703") {
        const { data: basic } = await admin
          .from("recruitment_candidates")
          .select(
            "id, nombre, email, telefono, ubicacion, es_cordoba_capital, area, anios_experiencia, skills, educacion, resumen, fortalezas, dudas, fit_score, area_scores, archivo_nombre"
          )
          .eq("search_id", poolId)
          .order("fit_score", { ascending: false, nullsFirst: false });
        candidates = ((basic ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
          ...c,
          fase: "pool",
          entrevista_transcript: null,
          entrevista_notas: null,
          entrevista_analisis: null,
          grupos: [],
        })) as unknown as PoolCandidate[];
      } else {
        candidates = ((noGrupos ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
          ...c,
          grupos: [],
        })) as unknown as PoolCandidate[];
      }
    } else {
      candidates = (data ?? []) as PoolCandidate[];
    }
  }
  // Lista de grupos existentes (para el filtro y el autocompletado).
  const allGrupos = Array.from(
    new Set(candidates.flatMap((c) => c.grupos ?? []))
  ).sort((a, b) => a.localeCompare(b, "es"));

  // Búsquedas guardadas (grupos). Se quedan como sección secundaria: el flujo
  // principal es el pool.
  const { data: searches } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, ubicacion_pref, estado, created_at, es_pool")
    .order("created_at", { ascending: false });
  const grupos = ((searches ?? []) as {
    id: string;
    titulo: string;
    area: string | null;
    ubicacion_pref: string | null;
    estado: string;
    es_pool: boolean | null;
  }[]).filter((s) => s.es_pool !== true && s.titulo !== POOL_TITULO);

  const { data: cand } = await admin
    .from("recruitment_candidates")
    .select("search_id");
  const countBy = new Map<string, number>();
  for (const c of (cand ?? []) as { search_id: string }[]) {
    countBy.set(c.search_id, (countBy.get(c.search_id) ?? 0) + 1);
  }

  // Estado de Gmail: conectado + si el auto-refresh viene fallando (>2 días
  // sin refrescar el token → se cayó de verdad; el cron diario lo mantiene).
  const { data: gm, error: gmErr } = await admin
    .from("gmail_account")
    .select("email, token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  const gmailMigrated = !(gmErr && (gmErr as { code?: string }).code === "42P01");
  const gmailRow = gm as { email?: string | null; token_expires_at?: string | null } | null;
  const gmailEmail = gmailRow?.email ?? null;
  const exp = gmailRow?.token_expires_at ? new Date(gmailRow.token_expires_at).getTime() : 0;
  const gmailBroken =
    !!gmailEmail && (!gmailRow?.token_expires_at || exp < Date.now() - 2 * 24 * 3600 * 1000);

  const areaProfiles = await buildAreaProfiles(admin);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Briefcase className="h-6 w-6 text-primary" /> Reclutamiento
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Tu <b>pool de talento</b>: todos los CVs analizados por la IA y
          clasificados para su mejor rol. Filtrá por puesto, ubicación y fase, y
          marcá a cada uno (entrevista → siguiente fase → contratado) acá mismo.
        </p>
      </div>

      <Suspense fallback={null}>
        <RecruitmentGmailConnection
          connectedEmail={gmailEmail}
          migrated={gmailMigrated}
          broken={gmailBroken}
        />
      </Suspense>

      {gmailEmail && !gmailBroken && <RecruitmentPoolImport connected />}

      {candidates.length > 0 && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <b>{candidates.length}</b> CVs en el pool. Elegí un rol para ver los más
          aptos para ese puesto.
        </div>
      )}

      <RecruitmentPoolCandidates
        poolId={poolId}
        candidates={candidates}
        allGrupos={allGrupos}
        gruposEnabled={gruposEnabled}
      />

      {/* Búsquedas guardadas (grupos): sección secundaria y colapsada. */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <div>
            <div className="font-semibold">Búsquedas guardadas</div>
            <p className="text-sm text-muted-foreground">
              Grupos aparte con sus propios CVs (opcional). El pool de arriba es lo
              que usás en la diaria.
            </p>
          </div>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {grupos.length > 0 && <span>{grupos.length}</span>}
            <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <div className="space-y-3 border-t p-4">
          <div className="flex justify-end">
            <RecruitmentSearchForm areaProfiles={areaProfiles} />
          </div>
          {grupos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay búsquedas guardadas. Casi siempre alcanza con el pool.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.map((s) => (
                <Link
                  key={s.id}
                  href={`/reclutamiento/${s.id}`}
                  className="group/card rounded-lg border bg-background p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{s.titulo}</div>
                    {s.estado === "cerrada" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Cerrada
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {areaLabel(s.area)} · {s.ubicacion_pref ?? "—"}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {countBy.get(s.id) ?? 0} candidatos
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/card:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Reclutamiento</h1>
      <Card>
        <CardContent className="space-y-2 py-8 text-sm">
          <p className="font-medium">Falta aplicar una migración de base de datos.</p>
          <p className="text-muted-foreground">
            Corré <code>supabase/migrations/0098_recruitment_pool.sql</code> (y las
            posteriores) en el SQL editor de Supabase y recargá esta página.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
