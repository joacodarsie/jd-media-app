import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DirectorDashboard,
  type DirectorReportView,
} from "@/components/director-report-list";
import type { DirectorIdea } from "@/lib/director/insight";

export const dynamic = "force-dynamic";

export default async function DirectorPage({
  searchParams,
}: {
  searchParams: { semana?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  // Semanas disponibles (distintas), para el selector histórico.
  const { data: semanasRaw } = await supabase
    .from("director_reports")
    .select("semana")
    .order("semana", { ascending: false })
    .limit(400);
  const semanas = Array.from(
    new Set(((semanasRaw ?? []) as { semana: string }[]).map((r) => r.semana))
  );

  const selectedSemana =
    searchParams.semana && semanas.includes(searchParams.semana)
      ? searchParams.semana
      : semanas[0] ?? null;

  let reports: DirectorReportView[] = [];
  if (selectedSemana) {
    const { data } = await supabase
      .from("director_reports")
      .select(
        "id, status, pack, quota_reels, quota_posts, proy_reels, proy_posts, pub_reels, pub_posts, pub_reels_week, pub_posts_week, pipeline_next, resumen, ideas, cliente:clients(nombre)"
      )
      .eq("semana", selectedSemana)
      .order("status", { ascending: false });

    type Row = {
      id: string;
      status: "al_dia" | "brechas";
      pack: string | null;
      quota_reels: number;
      quota_posts: number;
      proy_reels: number;
      proy_posts: number;
      pub_reels: number;
      pub_posts: number;
      pub_reels_week: number;
      pub_posts_week: number;
      pipeline_next: number;
      resumen: string;
      ideas: unknown;
      cliente: { nombre: string } | null;
    };

    reports = ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      cliente_nombre: r.cliente?.nombre ?? "—",
      pack: r.pack,
      status: r.status,
      quota_reels: r.quota_reels,
      quota_posts: r.quota_posts,
      proy_reels: r.proy_reels,
      proy_posts: r.proy_posts,
      pub_reels: r.pub_reels,
      pub_posts: r.pub_posts,
      pub_reels_week: r.pub_reels_week ?? 0,
      pub_posts_week: r.pub_posts_week ?? 0,
      pipeline_next: r.pipeline_next,
      resumen: r.resumen,
      ideas: (Array.isArray(r.ideas) ? r.ideas : []) as DirectorIdea[],
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Director Creativo</h1>
        <p className="text-sm text-muted-foreground">
          Cómo viene cada cliente respecto a su pack — contratado vs subido.
        </p>
      </div>
      <DirectorDashboard
        reports={reports}
        semanas={semanas}
        selectedSemana={selectedSemana}
        isStaff={isStaff(me.rol)}
      />
    </div>
  );
}
