import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, CircleDashed } from "lucide-react";
import { requireClientAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyMeetingWorkspace } from "@/components/monthly-meeting-workspace";
import { AIFeedback } from "@/components/ai-feedback";
import { periodLabel, prevPeriod } from "@/lib/finanzas";
import { hoyYmd, fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  hasClientReport,
  hasMonthlyContent,
  normalizeClientReport,
  normalizeMonthlyDiagnostic,
  periodoDeReunion,
  SEMAFORO_LABEL,
  type ClientMonthlyReport,
  type MonthlyDiagnosticContent,
  type Semaforo,
} from "@/lib/monthly-diagnostics/schema";

export const dynamic = "force-dynamic";

const SEMAFORO_DOT: Record<Semaforo, string> = {
  bien: "bg-emerald-500",
  atencion: "bg-amber-500",
  riesgo: "bg-red-500",
};

/** Los últimos 12 meses hasta el período de la reunión, para el selector. */
function ultimosMeses(hasta: string, cantidad = 12): string[] {
  const out: string[] = [];
  let p = hasta;
  for (let i = 0; i < cantidad; i++) {
    out.push(p);
    p = prevPeriod(p);
  }
  return out;
}

export default async function ReunionMensualPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string };
}) {
  await requireClientAccess(params.id);
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const porDefecto = periodoDeReunion(hoyYmd());
  const periodo =
    searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes) ? searchParams.mes : porDefecto;

  // El historial puede fallar si todavía no se aplicó la migración: la página
  // tiene que seguir abriendo igual (regla del CLAUDE.md).
  const [diagRes, histRes, reporteRes, meetingRes, tokenRes] = await Promise.all([
    admin
      .from("client_monthly_diagnostics")
      .select(
        "content, client_report, generated_at, shared_at, tasks_created_at, tasks_created_count"
      )
      .eq("cliente_id", params.id)
      .eq("periodo", periodo)
      .maybeSingle(),
    admin
      .from("client_monthly_diagnostics")
      .select("periodo, content, generated_at")
      .eq("cliente_id", params.id)
      .order("periodo", { ascending: false })
      .limit(24),
    admin
      .from("client_monthly_reports")
      .select("ai_meet_guion")
      .eq("cliente_id", params.id)
      .eq("year_month", periodo)
      .maybeSingle(),
    admin
      .from("client_meetings")
      .select("fecha")
      .eq("cliente_id", params.id)
      .eq("periodo", periodo)
      .maybeSingle(),
    // El informe del cliente se abre con el token del portal que ya tiene.
    admin
      .from("client_portal_tokens")
      .select("token")
      .eq("cliente_id", params.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const faltaMigracion = !!diagRes.error || !!histRes.error;

  const diagRow = diagRes.data as {
    content?: unknown;
    client_report?: unknown;
    generated_at?: string | null;
    shared_at?: string | null;
    tasks_created_at?: string | null;
    tasks_created_count?: number | null;
  } | null;

  const diagnostico: MonthlyDiagnosticContent | null = hasMonthlyContent(diagRow?.content)
    ? normalizeMonthlyDiagnostic(diagRow!.content)
    : null;

  const informe: ClientMonthlyReport | null = hasClientReport(diagRow?.client_report)
    ? normalizeClientReport(diagRow!.client_report)
    : null;

  const historial = ((histRes.data ?? []) as { periodo: string; content: unknown }[])
    .filter((r) => hasMonthlyContent(r.content))
    .map((r) => ({
      periodo: r.periodo,
      semaforo: normalizeMonthlyDiagnostic(r.content).semaforo,
    }));

  const meses = ultimosMeses(porDefecto);
  const conDiagnostico = new Set(historial.map((h) => h.periodo));
  const reunionFecha = (meetingRes.data as { fecha?: string } | null)?.fecha ?? null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clientes/${params.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Link>
          </Button>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Reunión mensual
            </div>
            <h1 className="text-2xl font-semibold">{client.nombre}</h1>
          </div>
        </div>
        {reunionFecha ? (
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CalendarCheck2 className="h-3.5 w-3.5" /> Reunión hecha el {fmtDate(reunionFecha)}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            <CircleDashed className="h-3.5 w-3.5" /> Reunión de {periodLabel(periodo)} sin registrar
          </div>
        )}
      </div>

      {faltaMigracion && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Falta aplicar la migración <code>0148_client_monthly_diagnostics.sql</code> en Supabase.
          Hasta entonces el guión funciona, pero el diagnóstico del mes no se puede guardar.
        </div>
      )}

      {/* Selector de mes — la reunión habla del mes que se cierra. */}
      <div className="flex flex-wrap gap-1.5">
        {meses.map((m) => {
          const activo = m === periodo;
          return (
            <Link
              key={m}
              href={`/clientes/${params.id}/reunion?mes=${m}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition",
                activo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {conDiagnostico.has(m) && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    SEMAFORO_DOT[
                      historial.find((h) => h.periodo === m)?.semaforo ?? "atencion"
                    ]
                  )}
                />
              )}
              {periodLabel(m)}
            </Link>
          );
        })}
      </div>

      <MonthlyMeetingWorkspace
        clienteId={params.id}
        clienteNombre={client.nombre}
        periodo={periodo}
        mesLabel={periodLabel(periodo)}
        guion={(reporteRes.data as { ai_meet_guion?: string | null } | null)?.ai_meet_guion ?? null}
        diagnostico={diagnostico}
        diagnosticoAt={diagRow?.generated_at ?? null}
        tasksCreatedAt={diagRow?.tasks_created_at ?? null}
        tasksCreatedCount={diagRow?.tasks_created_count ?? null}
        reunionRegistrada={!!reunionFecha}
        informe={informe}
        portalToken={(tokenRes.data as { token?: string } | null)?.token ?? null}
        sharedAt={diagRow?.shared_at ?? null}
      />

      {/* Evolución: cómo viene la marca mes a mes. */}
      {historial.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cómo viene la cuenta mes a mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {historial.map((h) => (
                <Link
                  key={h.periodo}
                  href={`/clientes/${params.id}/reunion?mes=${h.periodo}`}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <span className={cn("h-2 w-2 rounded-full", SEMAFORO_DOT[h.semaforo])} />
                  <span className="font-medium">{periodLabel(h.periodo)}</span>
                  <span className="text-xs text-muted-foreground">
                    {SEMAFORO_LABEL[h.semaforo]}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {diagnostico && (
        <div className="flex items-center justify-end rounded-lg border bg-card/40 p-3">
          <AIFeedback
            feature="monthly_diagnostic"
            refId={`${params.id}:${periodo}`}
            clienteId={params.id}
            model={null}
          />
        </div>
      )}
    </div>
  );
}
