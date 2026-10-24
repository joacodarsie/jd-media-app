import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { periodLabel } from "@/lib/finanzas";
import { cargarCuentasCreativas, puedeCreativa } from "@/lib/creativa/cargar";
import { textoVigencia } from "@/lib/creativa/creativa";
import { imagenChica } from "@/lib/web/imagenes";
import { cn } from "@/lib/utils";
import { EstadoMes } from "./estado-mes";

export const dynamic = "force-dynamic";

const mesCorto = (m: string) => periodLabel(m).split(" ")[0].slice(0, 3);
const mesLargo = (m: string) => periodLabel(m).replace(/\s*de\s*/, " ");

/**
 * Área Creativa (pedido de Santi, 23/10/2026; boceto «Listado»): cada cuenta
 * activa con el estado del calendario de este mes y el que viene, el documento
 * de campaña que vence primero y cómo va su onboarding creativo.
 */
export default async function CreativaPage() {
  const me = await requireUser();
  if (!puedeCreativa(me)) redirect("/dashboard");
  const cuentas = await cargarCuentasCreativas(createAdmin(), hoyYmd());
  const meses = cuentas[0]?.meses.map((m) => m.mes) ?? [];
  const porVencer = cuentas.filter((c) => c.proximoVencimiento && c.proximoVencimiento.vigencia.estado !== "vigente").length;
  const sinDoc = cuentas.filter((c) => !c.docs.length).length;
  const columnas = "md:grid-cols-[minmax(0,2fr)_9rem_9rem_minmax(0,1.4fr)_4.5rem_1rem]";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">✨ Área Creativa</h1>
          <p className="text-sm text-muted-foreground">El calendario de cada cuenta, mes a mes, y sus documentos de campaña. Tocá una cuenta para ver su ficha.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {porVencer > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-red-700 dark:text-red-300">
              ⚠ {porVencer} documento{porVencer === 1 ? "" : "s"} para replantear
            </span>
          )}
          {sinDoc > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {sinDoc} cuenta{sinDoc === 1 ? "" : "s"} sin documento
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className={cn("hidden gap-3 border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid", columnas)}>
          <span>Cliente</span>
          {meses.map((m) => (
            <span key={m}>{mesLargo(m)}</span>
          ))}
          <span>Documento de campaña</span>
          <span>Onboarding</span>
          <span />
        </div>
        <ul className="divide-y">
          {cuentas.map((c) => {
            const d = c.proximoVencimiento;
            const alerta = d ? textoVigencia(d.vigencia) : null;
            const hechos = c.pasos.filter((p) => p.hecho).length;
            const doc = d
              ? alerta
                ? `⚠ ${alerta.replace(" — replantear estrategia", "")}`
                : `✓ Vigente hasta ${d.vigencia.vence!.slice(8, 10)}/${d.vigencia.vence!.slice(5, 7)}`
              : c.docs.length
                ? "Sin vigencia cargada"
                : "Sin documento";
            return (
              <li key={c.id}>
                <Link href={`/creativa/${c.id}`} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-muted/50", columnas)}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagenChica(c.logo, 64)} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">{c.nombre[0]}</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                      {c.rubro && <span className="block truncate text-xs text-muted-foreground">{c.rubro}</span>}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground md:order-last" />
                  {/* En el celular, una fila de chips; en compu, cada dato en su columna. */}
                  <span className="col-span-2 flex flex-wrap items-center gap-1.5 md:contents">
                    {c.meses.map((m) => (
                      <span key={m.mes}>
                        <span className="md:hidden">
                          <EstadoMes m={m} prefijo={mesCorto(m.mes)} />
                        </span>
                        <span className="hidden md:inline">
                          <EstadoMes m={m} />
                        </span>
                      </span>
                    ))}
                    <span className={cn("truncate text-xs", alerta ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{doc}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      <span className="md:hidden">Onboarding </span>
                      {hechos}/{c.pasos.length}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
