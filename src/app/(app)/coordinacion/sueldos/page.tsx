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
    mbAccounts,
    commission,
  } = await buildPeriodPayroll(admin, periodo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sueldos</h1>
        <p className="text-muted-foreground">
          Nómina del mes calculada automática desde el modelo de tarifas
          (CM, diseño, edición, media buyer y acuerdos fijos), más comisiones y
          extras que cargues a mano. Solo vos lo ves.
        </p>
      </div>
      <SueldosPanel
        periodo={periodo}
        people={people}
        totalNomina={totalNomina}
        salaryConcepto={salaryConcepto}
        clientOptions={clientOptions}
        teamOptions={teamOptions}
        mbAccounts={mbAccounts}
        commission={commission}
      />
    </div>
  );
}
