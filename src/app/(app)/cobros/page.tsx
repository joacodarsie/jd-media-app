import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { currentPeriod, periodLabel } from "@/lib/finanzas";
import { MonthPicker } from "@/components/month-picker";
import { CobrosSimple } from "@/components/cobros-simple";
import { FacturasColgadas } from "@/components/facturas-colgadas";
import { FinanzasAlertas } from "@/components/finanzas-alertas";
import { fetchFacturadoUltimos12Meses } from "@/lib/finanzas/facturacion";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { totalCobrado, totalPendiente } from "@/lib/finanzas/cobro-gestion";
import { cargarCobrosDelMes } from "@/lib/finanzas/cobros-mes";

export const dynamic = "force-dynamic";

/**
 * "¿Quién me pagó?" — la versión mínima de cobros.
 *
 * Existe porque el dueño lleva los cobros DE MEMORIA: julio cerró con 15
 * facturas emitidas y 0 marcadas como cobradas. Finanzas tiene 19 subpantallas
 * y él mismo dijo que se marea. Acá hay una sola lista, una fila por cliente
 * activo, y tres cosas por fila: cuánto, ¿pagó?, y una nota.
 *
 * No hace falta "generar las facturas del mes": la fila aparece igual y la
 * factura se crea sola cuando toca algo.
 */
export default async function CobrosSimplePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();

  const { filas, viejas, facturacionActiva } = await cargarCobrosDelMes(periodo);

  // Los totales cuentan las entregas a cuenta: "falta cobrar" tiene que ser lo
  // que falta DE VERDAD, no el abono entero de alguien que ya dejó la mitad.
  const cobrado = totalCobrado(filas);
  const falta = totalPendiente(filas);

  // Facturado y sin facturar del mes, EN PESOS. El porcentaje no sirve para lo
  // que el dueño necesita: para ARCA lo que importa es cuánta plata se facturó,
  // no qué proporción.
  const facturado = filas
    .filter((f) => f.cobradoEl && f.facturado)
    .reduce((a, f) => a + f.monto, 0);
  const sinFacturar = filas
    .filter((f) => f.cobradoEl && !f.facturado)
    .reduce((acc, f) => ({ monto: acc.monto + f.monto, cuenta: acc.cuenta + 1 }), {
      monto: 0,
      cuenta: 0,
    });

  // El número de ARCA: lo facturado en los doce meses corridos hacia atrás.
  const anual = facturacionActiva ? await fetchFacturadoUltimos12Meses(createAdmin(), hoyYmd()) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">¿Quién me pagó?</h1>
          <p className="text-muted-foreground">
            {periodLabel(periodo)}. Tildá a los que te pagaron y marcalos de una.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ¿Te pagó otro monto? Tocá el número y elegí si es{" "}
            <b className="font-semibold">solo este mes</b> o{" "}
            <b className="font-semibold">de ahora en más</b> (un aumento). ¿Te quedó
            debiendo? Usá <b className="font-semibold">Me pagó una parte</b>.
          </p>
        </div>
        <MonthPicker value={periodo} />
      </div>

      {/* Lo que está atrasado. Vivía en el hub de Finanzas, que se sacó; va acá
          porque es la pantalla operativa y las tres alertas linkean a esta
          misma sección. En el Resumen no puede ir: esa hoja se imprime y se
          muestra afuera. */}
      <FinanzasAlertas />

      <div className={cn("grid gap-3", facturacionActiva ? "sm:grid-cols-3" : "grid-cols-2")}>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">Ya entró</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
            ${cobrado.toLocaleString("es-AR")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Falta cobrar este mes</p>
          <p className="text-2xl font-bold tabular-nums">${falta.toLocaleString("es-AR")}</p>
        </div>
        {/* Tercer número, del mismo tamaño que los otros dos: para ARCA lo que
            importa es cuánta plata se facturó, no qué proporción. Un porcentaje
            no se puede llevar al contador. */}
        {facturacionActiva && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Facturado este mes</p>
            <p className="text-2xl font-bold tabular-nums">${facturado.toLocaleString("es-AR")}</p>
            {sinFacturar.monto > 0 && (
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                en negro ${sinFacturar.monto.toLocaleString("es-AR")} · {sinFacturar.cuenta} cobro
                {sinFacturar.cuenta === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* El número con el que se mide el monotributo: los doce meses corridos
          hacia atrás, no el año calendario. */}
      {anual && (
        <p className="text-xs text-muted-foreground">
          Facturado en los últimos 12 meses (lo que mira ARCA):{" "}
          <b className="tabular-nums text-foreground">${anual.monto.toLocaleString("es-AR")}</b>{" "}
          <span className="opacity-70">
            — desde el {anual.desde.slice(8, 10)}/{anual.desde.slice(5, 7)}/
            {anual.desde.slice(2, 4)}
          </span>
        </p>
      )}

      <CobrosSimple filas={filas} periodo={periodo} facturacionActiva={facturacionActiva} />

      <FacturasColgadas facturas={viejas} />

      <p className="text-xs text-muted-foreground">
        ¿Necesitás el detalle (a quién le pagás vos, gastos, mensajes de cobro)?
        Está en{" "}
        <Link href="/finanzas/mes" className="underline">
          La plata del mes
        </Link>
        . Esta pantalla es solo para marcar lo que entra.
      </p>
    </div>
  );
}
