import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  RecruitmentSearchForm,
  AREA_OPTIONS,
} from "@/components/recruitment-search-form";
import { RecruitmentUploader } from "@/components/recruitment-uploader";
import {
  RecruitmentCandidates,
  type Candidate,
} from "@/components/recruitment-candidates";

export const dynamic = "force-dynamic";

const areaLabel = (a: string | null) =>
  AREA_OPTIONS.find((o) => o.value === a)?.label ?? a ?? "—";

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
          <CardContent className="py-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Perfil buscado
            </span>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{s.perfil}</p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        💡 Bajá los CVs de los mails y arrastralos acá con <b>Cargar CVs (PDF)</b>. La
        IA lee cada uno, lo puntúa según el perfil y te deja filtrar por Córdoba,
        experiencia y aptitud. (Pronto: traerlos solos desde Gmail.)
      </div>

      <RecruitmentCandidates searchId={s.id} candidates={candidates} />
    </div>
  );
}
