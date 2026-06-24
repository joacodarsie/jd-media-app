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
  } = await buildPeriodPayroll(admin, periodo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sueldos</h1>
        <p className="text-muted-foreground">
          Nómina del mes: CM y media buyer por pack, <strong>diseño y edición
          por el contenido real publicado/aprobado del mes</strong>, acuerdos
          fijos y la comisión de cierre del primer mes de cada cliente nuevo.
          Sumá, editá o ajustá ítems a mano. Solo vos lo ves.
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
      />
    </div>
  );
}
