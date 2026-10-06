import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { tituloMadre, DIAS_ONBOARDING } from "@/lib/retencion/onboarding-15";
import { resumenDeArranques } from "@/lib/retencion/onboarding-panorama";
import { arranquesPorCuenta, cargarPanoramaArranques } from "@/lib/retencion/onboarding-panorama-run";
import { OnboardingPanorama } from "@/components/onboarding-panorama";
import { CuentasNuevasTablero } from "@/components/cuentas-nuevas-tablero";
import { computeAccountHealth } from "@/lib/director/health";
import { cargarCuentasNuevas } from "@/lib/retencion/cuentas-nuevas-run";
import { resumenCuentasNuevas, tableroCuentasNuevas } from "@/lib/retencion/cuentas-nuevas";

export const dynamic = "force-dynamic";

/**
 * Arranques: los onboardings de todas las cuentas nuevas, juntos.
 *
 * Nace el 21/9/2026 de dos problemas del mismo día: el onboarding no se creaba
 * nunca (cero tickets en la historia de la app) y, cuando se creaba, vivía
 * repartido en cuatro botones dentro de la ficha de cada cliente. Sin un lugar
 * donde verlos todos, nadie mira cómo arranca una cuenta — y el arranque es
 * donde se mueren: ninguna de las 7 bajas pasó de 3,2 meses.
 */
export default async function OnboardingPage() {
  const me = await requireUser();
  const admin = createAdmin();
  const puedeVer = userInRoles(me, ["admin", "coordinador"]);
  if (!puedeVer) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Esta sección la ven la dirección y la coordinación.
      </div>
    );
  }

  const hoy = hoyYmd();
  const { filas, madres } = await cargarPanoramaArranques(admin, hoy);
  const resumen = resumenDeArranques(filas);

  // El tablero de los primeros 90 días cruza el arranque con el semáforo de
  // salud, la primera pieza, la reunión del mes y el cobro.
  const porCuenta = arranquesPorCuenta(filas);
  const salud = await computeAccountHealth(admin).catch(() => null);
  const { cuentas } = await cargarCuentasNuevas(admin, hoy, {
    arranques: porCuenta,
    salud: new Map((salud?.cuentas ?? []).map((c) => [c.id, { semaforo: c.semaforo, alertas: c.alertas }])),
  });
  const tablero = tableroCuentasNuevas(cuentas, hoy);
  const resTablero = resumenCuentasNuevas(tablero);

  // Cuentas activas recientes que todavía no tienen su ticket: no debería
  // pasar (el cron lo arma solo), pero si pasa hay que verlo acá y no en la
  // base. Es el mismo problema que estuvo escondido tres meses.
  const { data: activasRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const conTicket = new Set(madres.map((m) => m.cliente!.nombre));
  const sinArranque = ((activasRaw ?? []) as {
    id: string;
    nombre: string;
    fecha_inicio: string | null;
  }[]).filter((c) => {
    if (conTicket.has(c.nombre) || madres.some((m) => m.titulo === tituloMadre(c.nombre)))
      return false;
    if (!c.fecha_inicio) return false;
    const dias =
      (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${c.fecha_inicio.slice(0, 10)}T00:00:00Z`)) /
      86_400_000;
    return dias <= 30;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cuentas nuevas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Los primeros 90 días de cada cuenta. Es donde se decide si se queda: ninguna de las
          bajas de la agencia pasó de 3,2 meses.
        </p>
      </div>

      {tablero.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-card px-3 py-1">
            <b>{resTablero.total}</b> cuentas nuevas
          </span>
          {resTablero.mal > 0 && (
            <span className="rounded-full border border-red-500/50 px-3 py-1 text-red-700 dark:text-red-300">
              <b>{resTablero.mal}</b> en riesgo
            </span>
          )}
          {resTablero.atento > 0 && (
            <span className="rounded-full border border-amber-500/50 px-3 py-1 text-amber-800 dark:text-amber-300">
              <b>{resTablero.atento}</b> para mirar
            </span>
          )}
        </div>
      )}

      <CuentasNuevasTablero filas={tablero} />

      <h2 className="pt-4 text-lg font-semibold">Arranque de {DIAS_ONBOARDING} días</h2>

      {filas.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-card px-3 py-1">
            <b>{resumen.enCurso}</b> arrancando
          </span>
          {resumen.conAtraso > 0 && (
            <span className="rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <b>{resumen.conAtraso}</b> con pasos atrasados ({resumen.pasosAtrasados} en total)
            </span>
          )}
        </div>
      )}

      {sinArranque.length > 0 && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {sinArranque.length} cuenta{sinArranque.length === 1 ? "" : "s"} activa
            {sinArranque.length === 1 ? "" : "s"} sin plan de arranque
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            {sinArranque.map((c) => c.nombre).join(", ")}. El cron de la noche lo arma solo; si
            mañana sigue acá, avisá.
          </p>
        </div>
      )}

      <OnboardingPanorama filas={filas} />
    </div>
  );
}
