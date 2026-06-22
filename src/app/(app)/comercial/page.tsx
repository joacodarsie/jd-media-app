import Link from "next/link";
import { Plus, Sparkles, GraduationCap, FileClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { requireUser, userHas } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { LeadKanban, type LeadRow } from "@/components/lead-kanban";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { NewProposalDialog } from "@/components/new-proposal-dialog";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export default async function ComercialPage() {
  const me = await requireUser();
  if (!COMERCIAL_ROLES.includes(me.rol) && !userHas(me, "comercial")) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const admin = createAdmin();

  const [{ data: leads }, { data: services }, { data: users }, { data: propuestas }] =
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
      // Propuestas enviadas que todavía no pagaron (estado "propuesta"): para
      // seguirlas y cobrarlas. Vía admin: la página ya está gateada por rol.
      admin
        .from("clients")
        .select("id, nombre, created_at, monto_mensual")
        .eq("estado", "propuesta")
        .order("created_at", { ascending: true }),
    ]);

  const propuestasRows = (propuestas ?? []) as {
    id: string;
    nombre: string;
    created_at: string | null;
    monto_mensual: number | null;
  }[];
  const diasDesde = (iso: string | null): number =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : 0;

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
            Comercial
            <HelpTrigger
              slug="comercial"
              label="Cómo usar la sección comercial"
              size="md"
            />
          </h1>
          <p className="text-muted-foreground">
            Cuando un prospecto te pasa los datos, generá la carta acuerdo a un
            toque y seguila hasta que pague.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/comercial/feedback" title="Feedback de una reunión comercial con IA">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Feedback de reunión</span>
              <span className="sm:hidden">Feedback</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/comercial/post-meet" title="Generar mensaje post-meet con IA">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Mensaje post-meet</span>
              <span className="sm:hidden">Post-meet</span>
            </Link>
          </Button>
          <NewProposalDialog services={services ?? []} users={users ?? []} />
        </div>
      </div>

      {propuestasRows.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          Todavía no hay propuestas en curso. Cuando un prospecto te pase los datos,
          tocá <b className="text-foreground">Nueva propuesta</b>: cargás sus datos,
          armás la carta acuerdo y se la mandás con los datos de pago. Cuando
          transfiere, la activás y se vuelve cliente.
        </div>
      )}

      {propuestasRows.length > 0 && (
        <div className="rounded-lg border border-violet-300 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
            <FileClock className="h-4 w-4" />
            Propuestas esperando pago ({propuestasRows.length})
          </div>
          <p className="mb-3 text-xs text-violet-700/80 dark:text-violet-300/80">
            Cartas acuerdo enviadas que todavía no se activaron. Seguilas para
            cerrar el cobro; cuando paguen, activá la ficha.
          </p>
          <ul className="space-y-1.5">
            {propuestasRows.map((p) => {
              const dias = diasDesde(p.created_at);
              return (
                <li key={p.id}>
                  <Link
                    href={`/clientes/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-violet-300"
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.monto_mensual ? (
                        <span>ARS {Number(p.monto_mensual).toLocaleString("es-AR")}/mes</span>
                      ) : null}
                      <span
                        className={cn(
                          dias >= 7 ? "font-medium text-amber-600 dark:text-amber-400" : ""
                        )}
                      >
                        {dias === 0 ? "hoy" : `hace ${dias} día${dias === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pipeline de leads — secundario, colapsado por defecto */}
      <details className="group rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
          <div>
            <span className="font-semibold">Pipeline de leads</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {totalActivos} activos · {leadRows.filter((l) => l.stage === "ganado").length} cerrados
              {pipelineValor > 0 ? ` · ARS ${pipelineValor.toLocaleString("es-AR")}` : ""}
            </span>
          </div>
          <span className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <span className="group-open:hidden">Mostrar</span>
            <span className="hidden group-open:inline">Ocultar</span>
          </span>
        </summary>
        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Seguimiento opcional de oportunidades por etapa. Arrastrá las tarjetas
              entre columnas.
            </p>
            <LeadFormDialog
              mode="create"
              services={services ?? []}
              users={users ?? []}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo lead
                </Button>
              }
            />
          </div>
          <LeadKanban leads={leadRows} services={services ?? []} users={users ?? []} />
        </div>
      </details>
    </div>
  );
}
