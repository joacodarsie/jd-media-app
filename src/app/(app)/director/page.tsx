import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";
import { periodLabel } from "@/lib/finanzas";
import { AccountHealthDashboard } from "@/components/account-health-dashboard";

export const dynamic = "force-dynamic";

export default async function DirectorPage() {
  const me = await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { periodo, cuentas, resumen } = await computeAccountHealth(admin);

  const canGenerate = me.rol === "admin" || me.rol === "coordinador";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Director IA</h1>
        <p className="text-sm text-muted-foreground">
          Semáforo de salud de cada cuenta para el seguimiento quincenal — plan de contenido,
          crecimiento en Instagram y tareas al día.
        </p>
      </div>
      <AccountHealthDashboard
        cuentas={cuentas}
        resumen={resumen}
        periodoLabel={periodLabel(periodo)}
        canGenerate={canGenerate}
      />
    </div>
  );
}
