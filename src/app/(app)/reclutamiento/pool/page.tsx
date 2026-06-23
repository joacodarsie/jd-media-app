import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { RecruitmentPoolImport } from "@/components/recruitment-pool-import";
import {
  RecruitmentPoolCandidates,
  type PoolCandidate,
} from "@/components/recruitment-pool-candidates";
import { getOrCreatePoolSearch } from "@/lib/recruitment/pool";

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  let poolId: string;
  try {
    poolId = await getOrCreatePoolSearch(admin);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "42703" || code === "42P01") return <MigrationNotice />;
    throw e;
  }

  const { data: cand } = await admin
    .from("recruitment_candidates")
    .select(
      "id, nombre, email, telefono, ubicacion, es_cordoba_capital, area, anios_experiencia, skills, educacion, resumen, fortalezas, dudas, fit_score, area_scores, archivo_nombre"
    )
    .eq("search_id", poolId)
    .order("fit_score", { ascending: false, nullsFirst: false });
  const candidates = (cand ?? []) as PoolCandidate[];

  const { data: gm } = await admin
    .from("gmail_account")
    .select("email")
    .eq("id", 1)
    .maybeSingle();
  const gmailConnected = !!(gm as { email?: string | null } | null)?.email;

  return (
    <div className="space-y-5">
      <Link
        href="/reclutamiento"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Reclutamiento
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6 text-primary" /> Pool de talento
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Todos los CVs que te llegan, analizados una vez por la IA y clasificados
          para su mejor rol. Filtrá por rol y te ordena los más aptos para ese
          puesto. Volvé a tocar “Analizar todo” cuando lleguen CVs nuevos.
        </p>
      </div>

      {gmailConnected ? (
        <RecruitmentPoolImport connected />
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
          Conectá Gmail en <Link href="/reclutamiento" className="text-primary hover:underline">Reclutamiento</Link> para traer los CVs automáticamente.
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <b>{candidates.length}</b> CVs en el pool. Elegí un rol abajo para ver los
          mejores para ese puesto.
        </div>
      )}

      <RecruitmentPoolCandidates poolId={poolId} candidates={candidates} />
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Layers className="h-6 w-6 text-primary" /> Pool de talento
      </h1>
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="font-medium">Falta aplicar la migración 0098</p>
          <p className="text-sm text-muted-foreground">
            Corré <code>0098_recruitment_pool.sql</code> en Supabase y recargá.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
