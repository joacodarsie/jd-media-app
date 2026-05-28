import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DirectorReportList,
  type DirectorReportView,
} from "@/components/director-report-list";
import type { DirectorIdea } from "@/lib/director/insight";

export const dynamic = "force-dynamic";

export default async function DirectorPage() {
  await requireUser();
  const supabase = createClient();

  // Semana más reciente con reportes.
  const { data: latest } = await supabase
    .from("director_reports")
    .select("semana")
    .order("semana", { ascending: false })
    .limit(1)
    .maybeSingle();

  const semana = (latest?.semana as string | undefined) ?? null;

  let reports: DirectorReportView[] = [];
  if (semana) {
    // RLS: staff ve todo; CM/creativa ven solo sus clientes.
    const { data } = await supabase
      .from("director_reports")
      .select(
        "id, status, pack, faltan_reels, faltan_posts, pipeline_next, resumen, ideas, cliente:clients(nombre)"
      )
      .eq("semana", semana)
      .order("status", { ascending: false }); // 'brechas' antes que 'al_dia'

    type Row = {
      id: string;
      status: "al_dia" | "brechas";
      pack: string | null;
      faltan_reels: number;
      faltan_posts: number;
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
      faltan_reels: r.faltan_reels,
      faltan_posts: r.faltan_posts,
      pipeline_next: r.pipeline_next,
      resumen: r.resumen,
      ideas: (Array.isArray(r.ideas) ? r.ideas : []) as DirectorIdea[],
    }));
  }

  const fecha = semana
    ? new Date(semana + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Director Creativo</h1>
        <p className="text-sm text-muted-foreground">
          Cómo viene cada cliente respecto a su pack.
          {fecha && ` Último parte: ${fecha}.`}
        </p>
      </div>
      <DirectorReportList reports={reports} />
    </div>
  );
}
