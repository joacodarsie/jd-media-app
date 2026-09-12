import Link from "next/link";
import { ArrowLeft, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, toARSFijos, fmtARS, currentPeriod, periodLabel } from "@/lib/finanzas";
import {
  ultimosPeriodos,
  armarSerie,
  compararMes,
  cascada,
  mesesDeAire,
  type Cascada as DatosCascada,
  type MesResumen,
  type MovimientoARS,
} from "@/lib/finanzas/resumen";
import { MonthPicker } from "@/components/month-picker";
import { PrintButton } from "@/components/print-button";
import { CerrarPagosBoton } from "@/components/cerrar-pagos-boton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MESES_SERIE = 12;
const CICLO_MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

/**
 * El resumen: una sola hoja que contesta cómo viene la agencia.
 *
 * El dueño pidió dos cosas de acá: entenderlo él de un vistazo, y poder
 * mostrárselo a sus padres sin tener que explicarlo. Por eso arranca con una
 * frase en castellano y no con un tablero de métricas: los números están
 * abajo, para el que quiera mirarlos.
 *
 * Todo sale de la plata que se movió DE VERDAD (facturas con fecha de cobro,
 * pagos con fecha de pago), no de lo facturado. Es la única forma de que el
 * número coincida con lo que hay en la cuenta.
 */
export default async function ResumenPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();
  const periodos = ultimosPeriodos(periodo, MESES_SERIE);
  const desde = `${periodos[0]}-01`;

  const [
    { data: invs },
    { data: pays },
    { data: exps },
    { data: subs },
    { data: fijosPend },
    rates,
    payroll,
  ] = await Promise.all([
      supabase
        .from("client_invoices")
        .select("monto, moneda, fecha_cobro, cliente:clients(nombre)")
        .not("fecha_cobro", "is", null)
        .gte("fecha_cobro", desde),
      supabase
        .from("team_payments")
        .select("monto, moneda, fecha_pago, usuario:users!team_payments_user_id_fkey(nombre)")
        .not("fecha_pago", "is", null)
        .gte("fecha_pago", desde),
      supabase
        .from("expenses")
        .select("monto, moneda, fecha_pago, concepto, proveedor, categoria")
        .not("fecha_pago", "is", null)
        .gte("fecha_pago", desde),
      supabase.from("subscriptions").select("costo, moneda, ciclo").eq("activa", true),
      // Los gastos fijos del mes que la app ya generó pero nadie marcó pagados.
      supabase
        .from("expenses")
        .select("monto, moneda")
        .eq("periodo", periodo)
        .eq("recurrente", true)
        .is("fecha_pago", null),
      getExchangeRates(),
      // La nómina CALCULADA del mes. No es lo que se registró como pagado: es
      // lo que el trabajo del mes costó. Sirve para detectar el agujero de
      // datos que hace mentir a esta hoja.
      buildPeriodPayroll(createAdmin(), periodo),
    ]);

  interface Inv {
    monto: number;
    moneda: string;
    fecha_cobro: string;
    cliente: { nombre: string } | null;
  }
  interface Pay {
    monto: number;
    moneda: string;
    fecha_pago: string;
    usuario: { nombre: string } | null;
  }
  interface Exp {
    monto: number;
    moneda: string;
    fecha_pago: string;
    concepto: string;
    proveedor: string | null;
    categoria: string;
  }

  const cobros = (invs ?? []) as unknown as Inv[];
  const pagos = (pays ?? []) as unknown as Pay[];
  const gastos = (exps ?? []) as unknown as Exp[];
  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);

  const movimientos: MovimientoARS[] = [
    ...cobros.map((i) => ({
      fecha: i.fecha_cobro,
      montoARS: ars(i.monto, i.moneda),
      tipo: "cobro" as const,
    })),
    ...pagos.map((p) => ({
      fecha: p.fecha_pago,
      montoARS: ars(p.monto, p.moneda),
      tipo: "equipo" as const,
    })),
    ...gastos.map((e) => ({
      fecha: e.fecha_pago,
      montoARS: ars(e.monto, e.moneda),
      tipo: "gasto" as const,
    })),
  ];

  const serie = armarSerie(periodos, movimientos);
  const comp = compararMes(serie, periodo)!;
  const mes = comp.mes;

  // La estructura: lo que se paga todos los meses pase lo que pase.
  const estructura = ((subs ?? []) as { costo: number; moneda: string; ciclo: string }[]).reduce(
    (a, s) => a + toARSFijos(Number(s.costo), s.moneda, rates) / (CICLO_MESES[s.ciclo] ?? 1),
    0
  );
  const aire = mesesDeAire(comp.acumulado, estructura);

  // De dónde vino la plata del mes, y en qué se fue.
  const deClientes = agrupar(
    cobros.filter((i) => i.fecha_cobro.startsWith(periodo)),
    (i) => i.cliente?.nombre ?? "Sin cliente",
    (i) => ars(i.monto, i.moneda)
  );
  const alEquipo = agrupar(
    pagos.filter((p) => p.fecha_pago.startsWith(periodo)),
    (p) => p.usuario?.nombre ?? "Sin asignar",
    (p) => ars(p.monto, p.moneda)
  );
  const enGastos = agrupar(
    gastos.filter((e) => e.fecha_pago.startsWith(periodo)),
    (e) => e.categoria,
    (e) => ars(e.monto, e.moneda)
  );

  const sinDatos = mes.entro === 0 && mes.salio === 0;

  // ═══ El control de que la hoja no esté mintiendo ═══
  //
  // Los egresos salen de lo REGISTRADO como pagado. Si los sueldos del mes no
  // se marcaron, la hoja dice que quedó todo lo que entró, que es falso — y es
  // justo la hoja que el dueño le va a mostrar a su familia. Así que se compara
  // contra la nómina calculada y, si hay diferencia, se dice antes que nada.
  const nominaCalculada = payroll.totalNomina;
  const faltaEquipo = Math.max(0, nominaCalculada - mes.equipo);
  // La estructura: lo que quedó generado como gasto del mes y sin marcar. Es
  // exacto, no una estimación — si la mitad ya está marcada, solo cuenta la otra.
  const faltaEstructura = ((fijosPend ?? []) as { monto: number; moneda: string }[]).reduce(
    (a, g) => a + ars(g.monto, g.moneda),
    0
  );
  const faltante = faltaEquipo + faltaEstructura;
  // Solo avisamos si el agujero cambia el resultado de forma relevante.
  const hayAgujero = !sinDatos && faltante > mes.entro * 0.05;
  const quedoReal = mes.quedo - faltante;

  // El titular usa el número CORREGIDO. Mostrar arriba "quedó todo lo que
  // entró" y abajo un cartel diciendo que no es cierto sería peor que no tener
  // la hoja. Cuando falta cargar cosas, no se compara contra el mes anterior:
  // ese mes tiene su propio agujero y la comparación no querría decir nada.
  const mesTitular: MesResumen = hayAgujero
    ? {
        ...mes,
        equipo: mes.equipo + faltaEquipo,
        gastos: mes.gastos + faltaEstructura,
        salio: mes.salio + faltante,
        quedo: quedoReal,
        pctQuedo: mes.entro > 0 ? (quedoReal / mes.entro) * 100 : 0,
      }
    : mes;
  const casc = cascada(mesTitular);

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      {/* Cabecera: no se imprime */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/finanzas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>
        <div className="flex items-center gap-3">
          <MonthPicker value={periodo} />
          <a
            href={`/api/finanzas/informe?m=${periodo}`}
            className="inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            title="Las 6 hojas con todos los números, para abrir en Excel o subir a Drive"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Bajar el informe
          </a>
          <PrintButton label="Imprimir / PDF" />
        </div>
      </div>

      {/* ═══ La hoja ═══ */}
      <div>
        <h1 className="text-3xl font-bold">JD Media</h1>
        <p className="text-lg capitalize text-muted-foreground">{periodLabel(periodo)}</p>
      </div>

      {/* Si faltan datos, se dice ANTES que el número. Una hoja que se muestra
          afuera no puede tener un número lindo y un asterisco abajo. */}
      {hayAgujero && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 dark:border-amber-500/50 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" /> Esta hoja todavía no es real
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Faltan cargar <b>{fmtARS(faltante)}</b> de gastos de este mes. El resultado de abajo
            ya los tiene en cuenta —por eso dice {fmtARS(quedoReal)} y no {fmtARS(mes.quedo)}—,
            pero es una <b>estimación</b> hasta que estén registrados de verdad.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {faltaEquipo > 0 && (
              <li className="flex items-baseline justify-between gap-3">
                <span>
                  Pagos al equipo sin marcar{" "}
                  <span className="text-xs text-muted-foreground">
                    la nómina del mes da {fmtARS(nominaCalculada)} y hay {fmtARS(mes.equipo)}{" "}
                    registrados
                  </span>
                </span>
                <Link
                  href="/coordinacion/sueldos"
                  className="shrink-0 whitespace-nowrap text-xs font-semibold underline print:hidden"
                >
                  Marcar pagos
                </Link>
              </li>
            )}
            {faltaEstructura > 0 && (
              <li className="flex items-baseline justify-between gap-3">
                <span>
                  La estructura del mes{" "}
                  <span className="text-xs text-muted-foreground">
                    {fmtARS(estructura)} de plataformas y monotributo, sin un gasto cargado
                  </span>
                </span>
                <Link
                  href="/finanzas/gastos"
                  className="shrink-0 whitespace-nowrap text-xs font-semibold underline print:hidden"
                >
                  Cargar gastos
                </Link>
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Si ya les transferiste y la estructura se debitó, dejalo registrado de una. Recién ahí
            esta hoja deja de ser una estimación y se puede mostrar afuera.
          </p>
          <CerrarPagosBoton
            periodo={periodo}
            etiquetaMes={periodLabel(periodo)}
            monto={fmtARS(faltante)}
          />
        </div>
      )}

      {/* La cascada: de lo que entró a lo que te queda a vos. Es lo primero que se lee. */}
      <div
        className={cn(
          "rounded-xl border-2 p-6",
          sinDatos
            ? "border-muted bg-muted/30"
            : mesTitular.quedo >= 0
              ? "border-emerald-400 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10"
              : "border-rose-400 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/10"
        )}
      >
        <Cascada cascada={casc} sinDatos={sinDatos} />
        {hayAgujero && !sinDatos && (
          <p className="mt-3 text-xs text-muted-foreground">
            Incluye {fmtARS(faltante)} que todavía no están cargados como pagados: los sueldos
            calculados del mes y la estructura. El detalle de abajo solo muestra lo registrado.
          </p>
        )}
      </div>

      {!sinDatos && (
        <>
          {/* De dónde vino y en qué se fue */}
          <div className="grid gap-5 md:grid-cols-2">
            <Columna titulo="De dónde vino la plata" total={mes.entro} filas={deClientes} />
            <div className="space-y-5">
              <Columna titulo="Lo que se le pagó al equipo" total={mes.equipo} filas={alEquipo} />
              {enGastos.length > 0 && (
                <Columna titulo="Los demás gastos" total={mes.gastos} filas={enGastos} />
              )}
            </div>
          </div>

          {/* Los últimos 12 meses */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Los últimos 12 meses
            </h2>
            <Barras serie={serie} destacado={periodo} />
            <div className="mt-4 grid gap-3 border-t pt-3 text-sm sm:grid-cols-3">
              <Chico
                label="Promedio por mes"
                valor={fmtARS(comp.promedio)}
                nota={`sobre ${comp.mesesConMovimiento} ${comp.mesesConMovimiento === 1 ? "mes" : "meses"} con movimiento`}
              />
              <Chico
                label="Acumulado del período"
                valor={fmtARS(comp.acumulado)}
                nota="lo que quedó sumando todos los meses"
              />
              {aire != null && (
                <Chico
                  label="Meses de aire"
                  valor={aire.toFixed(1)}
                  nota={`cuánto aguanta la estructura de ${fmtARS(estructura)} si dejara de entrar plata`}
                />
              )}
            </div>
          </div>

          {/* La tabla, para el que quiere el detalle */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Mes a mes · lo registrado
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-1.5 text-left font-semibold">Mes</th>
                    <th className="pb-1.5 text-right font-semibold">Entró</th>
                    <th className="pb-1.5 text-right font-semibold">Equipo</th>
                    <th className="pb-1.5 text-right font-semibold">Gastos</th>
                    <th className="pb-1.5 text-right font-semibold">Quedó</th>
                    <th className="pb-1.5 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {serie.map((m) => (
                    <tr
                      key={m.periodo}
                      className={cn(
                        "border-b last:border-0",
                        m.periodo === periodo && "bg-muted font-semibold",
                        m.entro === 0 && m.salio === 0 && "text-muted-foreground"
                      )}
                    >
                      <td className="py-1.5 capitalize">{periodLabel(m.periodo)}</td>
                      <td className="py-1.5 text-right">{m.entro ? fmtARS(m.entro) : "—"}</td>
                      <td className="py-1.5 text-right">{m.equipo ? fmtARS(m.equipo) : "—"}</td>
                      <td className="py-1.5 text-right">{m.gastos ? fmtARS(m.gastos) : "—"}</td>
                      <td
                        className={cn(
                          "py-1.5 text-right",
                          m.quedo < 0 && "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {m.entro || m.salio ? fmtARS(m.quedo) : "—"}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {m.entro ? `${Math.round(m.pctQuedo)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Todo lo de esta hoja es plata que se movió de verdad: facturas con fecha de cobro y pagos
        con fecha de pago. Lo facturado pero no cobrado no aparece acá —eso está en{" "}
        <Link href="/cobros" className="underline print:no-underline">
          Cobros
        </Link>
        .
      </p>
    </div>
  );
}

/** Agrupa y ordena de mayor a menor. Las 8 más grandes; el resto, juntas. */
function agrupar<T>(
  items: T[],
  clave: (x: T) => string,
  monto: (x: T) => number
): { nombre: string; monto: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = clave(it);
    m.set(k, (m.get(k) ?? 0) + monto(it));
  }
  const orden = [...m.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);
  if (orden.length <= 9) return orden;
  const resto = orden.slice(8).reduce((a, x) => a + x.monto, 0);
  return [...orden.slice(0, 8), { nombre: `Otros (${orden.length - 8})`, monto: resto }];
}

/**
 * De lo que entró a lo que te queda a vos, en cuatro pasos.
 *
 * Los porcentajes son lo importante: el dueño se maneja con ellos —"del mes 2
 * en adelante tengo un 40% en el pack básico, de ahí pago los fijos y lo que
 * sobra es mi sueldo"— y son lo que hace comparable un mes con otro aunque
 * haya facturado distinto.
 */
function Cascada({ cascada: c, sinDatos }: { cascada: DatosCascada; sinDatos: boolean }) {
  if (sinDatos) {
    return (
      <p className="text-lg font-medium">Todavía no hay movimientos cargados en este mes.</p>
    );
  }
  return (
    <>
      <dl className="space-y-1">
        <Paso label="Entró" detalle="lo que te pagaron los clientes" monto={c.entro} />
        <Paso
          label="Le pagaste al equipo"
          detalle="producción: diseño, edición, CM, pauta y coordinación"
          monto={-c.equipo}
          pct={c.entro > 0 ? -(c.equipo / c.entro) * 100 : 0}
        />
        <Paso
          label="Margen de la agencia"
          detalle="lo que dejan las cuentas después de pagar su producción"
          monto={c.margenAgencia}
          pct={c.margenPct}
          fuerte
        />
        <Paso
          label="Gastos fijos"
          detalle="monotributo, plataformas, la cuenta propia: se pagan con ese margen"
          monto={-c.fijos}
          pct={-c.fijosPct}
        />
      </dl>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t-2 pt-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu sueldo
          </p>
          <p className="text-[11px] text-muted-foreground">lo que sobra después de todo</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-3xl font-bold tabular-nums",
              c.tuSueldo < 0 && "text-rose-600 dark:text-rose-400"
            )}
          >
            {fmtARS(c.tuSueldo)}
          </p>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">
            {Math.round(c.tuSueldoPct)}% de lo que entró
          </p>
        </div>
      </div>
    </>
  );
}

function Paso({
  label,
  detalle,
  monto,
  pct,
  fuerte,
}: {
  label: string;
  detalle: string;
  monto: number;
  pct?: number;
  fuerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5",
        fuerte && "border-t pt-1.5 font-semibold"
      )}
    >
      <dt className="min-w-0">
        {label} <span className="text-xs font-normal text-muted-foreground">{detalle}</span>
      </dt>
      <dd className="shrink-0 text-right tabular-nums">
        {fmtARS(monto)}
        {pct != null && (
          <span className="ml-2 inline-block w-12 text-xs text-muted-foreground">
            {Math.round(pct)}%
          </span>
        )}
      </dd>
    </div>
  );
}

function Chico({ label, valor, nota }: { label: string; valor: string; nota: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{valor}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{nota}</p>
    </div>
  );
}

function Columna({
  titulo,
  total,
  filas,
}: {
  titulo: string;
  total: number;
  filas: { nombre: string; monto: number }[];
}) {
  const max = Math.max(1, ...filas.map((f) => f.monto));
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h2>
        <span className="text-sm font-bold tabular-nums">{fmtARS(total)}</span>
      </div>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin movimientos este mes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filas.map((f) => (
            <li key={f.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{f.nombre}</span>
                <span className="shrink-0 tabular-nums">{fmtARS(f.monto)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/40"
                  style={{ width: `${Math.max(2, (f.monto / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Las barras del año. Dos por mes —lo que entró y lo que se fue— para que la
 * diferencia se vea de una, sin tener que leer números.
 */
function Barras({ serie, destacado }: { serie: MesResumen[]; destacado: string }) {
  const max = Math.max(1, ...serie.map((m) => Math.max(m.entro, m.salio)));
  const corto = (p: string) => {
    const [y, m] = p.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  };
  return (
    <>
      <div className="mt-4 flex items-end gap-1.5" style={{ height: 140 }}>
        {serie.map((m) => (
          <div key={m.periodo} className="flex h-full flex-1 flex-col justify-end gap-1">
            <div className="flex h-full items-end justify-center gap-0.5">
              <div
                title={`Entró ${fmtARS(m.entro)}`}
                className="w-1/2 rounded-t bg-emerald-500/70"
                style={{ height: `${(m.entro / max) * 100}%` }}
              />
              <div
                title={`Se fue ${fmtARS(m.salio)}`}
                className="w-1/2 rounded-t bg-rose-400/70"
                style={{ height: `${(m.salio / max) * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "text-center text-[10px] capitalize text-muted-foreground",
                m.periodo === destacado && "font-bold text-foreground"
              )}
            >
              {corto(m.periodo)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/70" /> Entró
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-rose-400/70" /> Se fue
        </span>
      </div>
    </>
  );
}
