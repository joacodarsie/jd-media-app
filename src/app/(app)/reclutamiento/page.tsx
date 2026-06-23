import Link from "next/link";
import { Suspense } from "react";
import { Users, ArrowRight, Briefcase } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { RecruitmentSearchForm } from "@/components/recruitment-search-form";
import { RecruitmentGmailConnection } from "@/components/recruitment-gmail-connection";
import { buildAreaProfiles } from "@/lib/recruitment/area-profile";
import { areaLabel } from "@/lib/recruitment/areas";

export const dynamic = "force-dynamic";

export default async function ReclutamientoPage() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  const { data: searches, error } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, ubicacion_pref, estado, created_at")
    .order("created_at", { ascending: false });

  // La migración 0094 todavía no aplicada → mensaje claro en vez de error.
  if (error && (error as { code?: string }).code === "42P01") {
    return <MigrationNotice />;
  }

  const rows = (searches ?? []) as {
    id: string;
    titulo: string;
    area: string | null;
    ubicacion_pref: string | null;
    estado: string;
    created_at: string;
  }[];

  // Conteo de candidatos por búsqueda.
  const { data: cand } = await admin
    .from("recruitment_candidates")
    .select("search_id");
  const countBy = new Map<string, number>();
  for (const c of (cand ?? []) as { search_id: string }[]) {
    countBy.set(c.search_id, (countBy.get(c.search_id) ?? 0) + 1);
  }

  // Estado de la conexión a Gmail (para traer CVs de los mails).
  const { data: gm, error: gmErr } = await admin
    .from("gmail_account")
    .select("email")
    .eq("id", 1)
    .maybeSingle();
  const gmailMigrated = !(gmErr && (gmErr as { code?: string }).code === "42P01");
  const gmailEmail = (gm as { email?: string | null } | null)?.email ?? null;

  // Perfil automático por área (de los puestos/procesos de la agencia).
  const areaProfiles = await buildAreaProfiles(admin);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Briefcase className="h-6 w-6 text-primary" /> Reclutamiento
          </h1>
          <p className="text-muted-foreground">
            Subí los CVs de una búsqueda y la IA te los analiza y ordena por aptitud.
            Filtrás por ubicación (Córdoba), área y experiencia en vez de abrir mil mails.
          </p>
        </div>
        <RecruitmentSearchForm areaProfiles={areaProfiles} />
      </div>

      <Suspense fallback={null}>
        <RecruitmentGmailConnection connectedEmail={gmailEmail} migrated={gmailMigrated} />
      </Suspense>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Todavía no hay búsquedas. Creá la primera con{" "}
            <b>Nueva búsqueda</b> y empezá a cargar CVs.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/reclutamiento/${s.id}`}
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
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
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Reclutamiento</h1>
      <Card>
        <CardContent className="space-y-2 py-8 text-sm">
          <p className="font-medium">Falta aplicar la migración de base de datos.</p>
          <p className="text-muted-foreground">
            Corré <code>supabase/migrations/0094_recruitment.sql</code> en el SQL
            editor de Supabase y recargá esta página.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
