import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { SueldosPanel } from "@/components/sueldos-panel";

export const dynamic = "force-dynamic";

export default async function SueldosPage({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const periodo = searchParams.periodo ?? currentPeriod();

  const {
    people,
    totalNomina,
    salaryConcepto,
    clientOptions,
    teamOptions,
    commission,
    coordinacion,
    settings,
  } = await buildPeriodPayroll(admin, periodo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sueldos</h1>
        <p className="text-muted-foreground">
          Cuánto le pagás al equipo este mes, en qué se va y con qué regla se
          calcula cada puesto. Solo vos lo ves.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>Elegí el mes TRABAJADO.</strong> Cada mes se paga al mes
          siguiente (ej: lo de junio lo pagás en julio). El lápiz junto al total
          de cada persona te deja <strong>fijar el sueldo entero</strong> de una.
        </p>
      </div>
      <SueldosPanel
        periodo={periodo}
        people={people}
        totalNomina={totalNomina}
        salaryConcepto={salaryConcepto}
        clientOptions={clientOptions}
        teamOptions={teamOptions}
        commission={commission}
        coordinacion={coordinacion}
        settings={settings}
      />
    </div>
  );
}
