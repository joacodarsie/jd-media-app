import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireClientAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { DiagnosticWorkspace } from "@/components/diagnostic-workspace";
import { AIFeedback } from "@/components/ai-feedback";
import { HelpTrigger } from "@/components/help-trigger";
import type { DiagnosticRow } from "@/lib/diagnostics/schema";

export const dynamic = "force-dynamic";

export default async function DiagnosticoPage({
  params,
}: {
  params: { id: string };
}) {
  await requireClientAccess(params.id);
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, rubro, pack")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  // Traer todas las versiones (para el selector de historial), draft activo si hay,
  // o la aprobada actual.
  const { data: rows } = await admin
    .from("client_diagnostics")
    .select(
      "id, cliente_id, version, status, content, transcript_text, source_pdf_path, generated_with_model, generated_at, approved_at, approved_by, tasks_created_at, tasks_created_count, created_by, created_at, updated_at"
    )
    .eq("cliente_id", params.id)
    .order("version", { ascending: false });

  const versions = (rows ?? []) as unknown as DiagnosticRow[];
  // El "activo" es el primer draft que veamos, sino la última aprobada, sino nada.
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const approved = versions.find((v) => v.status === "approved") ?? null;
  const active = draft ?? approved ?? null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clientes/${params.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              Diagnóstico inicial
              <HelpTrigger slug="diagnostico" label="Cómo usar el diagnóstico" />
            </div>
            <h1 className="text-2xl font-semibold">{client.nombre}</h1>
          </div>
        </div>
        {active?.status === "approved" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/diagnostico/cliente/${params.id}`} target="_blank">
              <FileText className="mr-1 h-4 w-4" /> Ver PDF
            </Link>
          </Button>
        )}
      </div>

      <DiagnosticWorkspace
        clienteId={params.id}
        clienteNombre={client.nombre}
        active={active}
        history={versions}
      />

      {active && active.status === "approved" && (
        <div className="flex items-center justify-end gap-2 rounded-lg border bg-card/40 p-3">
          <AIFeedback
            feature="diagnostic"
            refId={active.id}
            clienteId={params.id}
            model={active.generated_with_model ?? null}
          />
        </div>
      )}
    </div>
  );
}
