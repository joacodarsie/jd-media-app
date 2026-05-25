import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LeadKanban, type LeadRow } from "@/components/lead-kanban";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

export default async function ComercialPage() {
  await requireUser();
  const supabase = createClient();

  const [{ data: leads }, { data: services }, { data: users }] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, nombre, empresa, email, telefono, origen, servicio_interesado, monto_estimado, moneda, stage, asignado_a_id, notas, proxima_accion, proxima_accion_at, perdido_motivo, ganado_cliente_id, asignado:users!leads_asignado_a_id_fkey(id,nombre), servicio:services(slug,name)"
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("services")
        .select("slug, name")
        .eq("active", true)
        .order("orden"),
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
    ]);

  type RawLead = {
    id: string;
    nombre: string;
    empresa: string | null;
    email: string | null;
    telefono: string | null;
    origen: string | null;
    servicio_interesado: string | null;
    monto_estimado: number | null;
    moneda: string;
    stage: LeadRow["stage"];
    asignado_a_id: string | null;
    notas: string | null;
    proxima_accion: string | null;
    proxima_accion_at: string | null;
    perdido_motivo: string | null;
    ganado_cliente_id: string | null;
    asignado?: { id: string; nombre: string } | null;
    servicio?: { slug: string; name: string } | null;
  };

  const leadRows: LeadRow[] = ((leads ?? []) as unknown as RawLead[]).map(
    (l) => ({
      id: l.id,
      nombre: l.nombre,
      empresa: l.empresa,
      email: l.email,
      telefono: l.telefono,
      origen: l.origen,
      servicio_interesado: l.servicio_interesado,
      monto_estimado: l.monto_estimado,
      moneda: l.moneda,
      stage: l.stage,
      asignado_a_id: l.asignado_a_id,
      notas: l.notas,
      proxima_accion: l.proxima_accion,
      proxima_accion_at: l.proxima_accion_at,
      perdido_motivo: l.perdido_motivo,
      ganado_cliente_id: l.ganado_cliente_id,
      asignado_nombre: l.asignado?.nombre ?? null,
      servicio_nombre: l.servicio?.name ?? null,
    })
  );

  const totalActivos = leadRows.filter(
    (l) => l.stage !== "ganado" && l.stage !== "perdido"
  ).length;
  const pipelineValor = leadRows
    .filter((l) => l.stage !== "ganado" && l.stage !== "perdido")
    .reduce((acc, l) => acc + (l.monto_estimado ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Pipeline comercial
            <HelpTrigger
              slug="comercial"
              label="Cómo usar el pipeline comercial"
              size="md"
            />
          </h1>
          <p className="text-muted-foreground">
            Leads y oportunidades. Arrastrá tarjetas entre columnas para cambiar
            el estado.
          </p>
        </div>
        <LeadFormDialog
          mode="create"
          services={services ?? []}
          users={users ?? []}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo lead
            </Button>
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Leads activos" value={totalActivos} />
        <Stat
          label="Valor en pipeline"
          value={`ARS ${pipelineValor.toLocaleString("es-AR")}`}
        />
        <Stat
          label="Cerrados (histórico)"
          value={leadRows.filter((l) => l.stage === "ganado").length}
        />
      </div>

      <LeadKanban
        leads={leadRows}
        services={services ?? []}
        users={users ?? []}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
