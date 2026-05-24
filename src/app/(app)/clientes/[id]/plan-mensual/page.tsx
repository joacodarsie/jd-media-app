import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { ContentPlanWorkspace } from "@/components/content-plan-workspace";
import type { ContentPlanRow } from "@/lib/content-plans/schema";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function defaultPeriodLabel() {
  const d = new Date();
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export default async function PlanMensualPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const { data: rows } = await admin
    .from("client_content_plans")
    .select(
      "id, cliente_id, periodo_label, status, content, generated_with_model, generated_at, approved_at, approved_by, created_by, created_at, updated_at"
    )
    .eq("cliente_id", params.id)
    .order("created_at", { ascending: false });

  const plans = (rows ?? []) as unknown as ContentPlanRow[];
  const draft = plans.find((p) => p.status === "draft") ?? null;
  const active = plans.find((p) => p.status === "active") ?? null;
  const history = plans.filter((p) => p.id !== draft?.id && p.id !== active?.id);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/clientes/${params.id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Plan de contenido
          </div>
          <h1 className="text-2xl font-semibold">{client.nombre}</h1>
        </div>
      </div>

      <ContentPlanWorkspace
        clienteId={params.id}
        active={active}
        draft={draft}
        history={history}
        defaultPeriodLabel={defaultPeriodLabel()}
      />
    </div>
  );
}
