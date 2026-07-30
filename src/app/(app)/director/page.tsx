import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";
import { leerSnapshotDirector, periodosConSnapshot } from "@/lib/director/snapshots";
import { currentPeriod, periodLabel } from "@/lib/finanzas";
import { AccountHealthDashboard } from "@/components/account-health-dashboard";

export const dynamic = "force-dynamic";

export default async function DirectorPage({
  searchParams,
}: {
  searchParams?: { m?: string };
}) {
  const me = await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  const actual = currentPeriod();
  const pedido =
    searchParams?.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : actual;
  const esMesEnCurso = pedido === actual;

  // El mes en curso se calcula en vivo; los anteriores salen del registro
  // guardado, porque las señales de "hoy" (tareas vencidas, portal, IG de los
  // últimos 35 días) no se pueden reconstruir hacia atrás.
  const guardados = await periodosConSnapshot(admin);
  const data = esMesEnCurso
    ? await computeAccountHealth(admin)
    : await leerSnapshotDirector(admin, pedido);

  const canGenerate = me.rol === "admin" || me.rol === "coordinador";
  const meses = [actual, ...guardados.filter((p) => p !== actual)].slice(0, 13);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Director IA</h1>
          <p className="text-sm text-muted-foreground">
            Semáforo de salud de cada cuenta para el seguimiento quincenal — plan de contenido,
            crecimiento en Instagram y tareas al día.
          </p>
        </div>
        {meses.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {meses.map((p) => (
              <Link
                key={p}
                href={p === actual ? "/director" : `/director?m=${p}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  p === pedido
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {periodLabel(p)}
                {p === actual && " · en curso"}
              </Link>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <p className="font-medium">No hay registro de {periodLabel(pedido)}</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            El semáforo se calcula con datos de hoy (tareas vencidas, si el cliente
            entró al portal, Instagram de los últimos 35 días), así que los meses
            anteriores a que se empezara a guardar no se pueden reconstruir. De acá
            en adelante se guarda solo todos los días, y cuando cambia el mes queda
            congelado el cierre.
          </p>
        </div>
      ) : (
        <>
          {!esMesEnCurso && (
            <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
              Estás viendo el <b>cierre de {periodLabel(pedido)}</b>: cómo quedó cada
              cuenta el último día de ese mes. No se actualiza más.
            </p>
          )}
          <AccountHealthDashboard
            cuentas={data.cuentas}
            resumen={data.resumen}
            periodoLabel={periodLabel(data.periodo)}
            canGenerate={canGenerate && esMesEnCurso}
          />
        </>
      )}
    </div>
  );
}
