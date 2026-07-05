import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import {
  toARS,
  fmtARS,
  fmtCurrency,
  currentPeriod,
  prevPeriod,
  periodLabel,
} from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EVO_MONTHS = 12;

interface Movement {
  id: string;
  kind: "in" | "out";
  fecha: string;
  monto: number;
  moneda: string;
  concepto: string;
  contraparte: string;
  metodo: string | null;
}

interface MonthRow {
  periodo: string;
  ingresos: number;
  equipo: number;
  gastos: number;
  egresos: number;
  margen: number;
}

type Filtro = "todos" | "in" | "out";
type Vista = "detalle" | "mes";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: { t?: string; v?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();
  const vista: Vista = searchParams.v === "mes" ? "mes" : "detalle";
  const filtro: Filtro =
    searchParams.t === "in" ? "in" : searchParams.t === "out" ? "out" : "todos";

  const [{ data: invs }, { data: pays }, { data: exps }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, monto, moneda, fecha_cobro, concepto, metodo_pago, cliente:clients(nombre)"
      )
      .not("fecha_cobro", "is", null)
      .order("fecha_cobro", { ascending: false })
      .limit(300),
    supabase
      .from("team_payments")
      .select(
        "id, monto, moneda, fecha_pago, concepto, metodo_pago, usuario:users!team_payments_user_id_fkey(nombre)"
      )
      .not("fecha_pago", "is", null)
      .order("fecha_pago", { ascending: false })
      .limit(300),
    supabase
      .from("expenses")
      .select("id, monto, moneda, fecha_pago, concepto, metodo_pago, proveedor, categoria")
      .not("fecha_pago", "is", null)
      .order("fecha_pago", { ascending: false })
      .limit(300),
  ]);

  const ingresos: Movement[] = ((invs ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_cobro: string;
    concepto: string;
    metodo_pago: string | null;
    cliente: { nombre: string } | null;
  }[]).map((i) => ({
    id: "in_" + i.id,
    kind: "in",
    fecha: i.fecha_cobro,
    monto: Number(i.monto),
    moneda: i.moneda,
    concepto: i.concepto,
    contraparte: i.cliente?.nombre ?? "—",
    metodo: i.metodo_pago,
  }));

  const egresosEquipo: Movement[] = ((pays ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
    concepto: string;
    metodo_pago: string | null;
    usuario: { nombre: string } | null;
  }[]).map((p) => ({
    id: "out_" + p.id,
    kind: "out",
    fecha: p.fecha_pago,
    monto: Number(p.monto),
    moneda: p.moneda,
    concepto: "Equipo · " + p.concepto,
    contraparte: p.usuario?.nombre ?? "—",
    metodo: p.metodo_pago,
  }));

  const egresosGastos: Movement[] = ((exps ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
    concepto: string;
    metodo_pago: string | null;
    proveedor: string | null;
    categoria: string;
  }[]).map((e) => ({
    id: "exp_" + e.id,
    kind: "out",
    fecha: e.fecha_pago,
    monto: Number(e.monto),
    moneda: e.moneda,
    concepto: `${e.categoria} · ${e.concepto}`,
    contraparte: e.proveedor ?? "—",
    metodo: e.metodo_pago,
  }));

  const todos = [...ingresos, ...egresosEquipo, ...egresosGastos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha)
  );

  // Totales globales (sobre todo el historial cargado, sin filtrar) en ARS.
  const totalIn = todos
    .filter((m) => m.kind === "in")
    .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
  const totalOut = todos
    .filter((m) => m.kind === "out")
    .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);

  // ===== Serie mensual (vista "Por mes"), últimos 12 meses =====
  const periods: string[] = [];
  let pp = currentPeriod();
  for (let i = 0; i < EVO_MONTHS; i++) {
    periods.unshift(pp);
    pp = prevPeriod(pp);
  }
  const monthMap = new Map<string, MonthRow>();
  for (const per of periods)
    monthMap.set(per, {
      periodo: per,
      ingresos: 0,
      equipo: 0,
      gastos: 0,
      egresos: 0,
      margen: 0,
    });
  // Sumamos desde los arrays de origen (no parseando el texto del concepto).
  const addToMonth = (mv: Movement, field: "ingresos" | "equipo" | "gastos") => {
    const row = monthMap.get(mv.fecha.slice(0, 7));
    if (row) row[field] += toARS(mv.monto, mv.moneda, rates);
  };
  for (const m of ingresos) addToMonth(m, "ingresos");
  for (const m of egresosEquipo) addToMonth(m, "equipo");
  for (const m of egresosGastos) addToMonth(m, "gastos");
  const series = periods.map((per) => {
    const r = monthMap.get(per)!;
    r.egresos = r.equipo + r.gastos;
    r.margen = r.ingresos - r.egresos;
    return r;
  });
  const maxBar = Math.max(1, ...series.map((s) => Math.max(s.ingresos, s.egresos)));
  const conMov = series.filter((s) => s.ingresos > 0 || s.egresos > 0);
  const totalIngresos12 = series.reduce((a, s) => a + s.ingresos, 0);
  const totalEgresos12 = series.reduce((a, s) => a + s.egresos, 0);
  const margenTotal12 = totalIngresos12 - totalEgresos12;
  const margenProm = conMov.length
    ? conMov.reduce((a, s) => a + s.margen, 0) / conMov.length
    : 0;
  const ultimo = series[series.length - 1];
  const anterior = series[series.length - 2];
  const delta = ultimo && anterior ? ultimo.margen - anterior.margen : 0;
  const shortLabel = (per: string) => {
    const [y, m] = per.split("-").map(Number);
    return new Date(y, m - 1, 1)
      .toLocaleDateString("es-AR", { month: "short" })
      .replace(".", "");
  };

  // Ledger: aplicar filtro de tipo y agrupar por mes.
  const all = filtro === "todos" ? todos : todos.filter((m) => m.kind === filtro);
  const byMonth = new Map<string, Movement[]>();
  for (const m of all) {
    const k = m.fecha.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(m);
  }

  const suffix = filtro === "todos" ? "" : `&t=${filtro}`;

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Movimientos</h1>
        <p className="text-muted-foreground">
          Todo lo que entró y salió (cobros, pagos al equipo y gastos). Mirá el{" "}
          <b>detalle</b> movimiento por movimiento o la <b>evolución por mes</b>.
        </p>
      </div>

      {/* Toggle de vista */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "detalle", label: "Detalle", href: `/finanzas/movimientos${suffix ? `?t=${filtro}` : ""}` },
            { key: "mes", label: "Por mes", href: "/finanzas/movimientos?v=mes" },
          ] as const
        ).map((opt) => (
          <Link
            key={opt.key}
            href={opt.href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              vista === opt.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {vista === "mes" ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label={`Margen ${periodLabel(ultimo.periodo)}`}
              value={fmtARS(ultimo.margen)}
              tone={ultimo.margen >= 0 ? "good" : "bad"}
              delta={delta}
            />
            <Kpi
              label="Margen promedio"
              value={fmtARS(margenProm)}
              sub={`${conMov.length} meses con movimiento`}
            />
            <Kpi label="Ingresos 12m" value={fmtARS(totalIngresos12)} tone="good" />
            <Kpi
              label="Margen acumulado 12m"
              value={fmtARS(margenTotal12)}
              tone={margenTotal12 >= 0 ? "good" : "bad"}
            />
          </div>

          {/* Gráfico de barras: ingresos vs egresos por mes */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Ingresos vs egresos por mes</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ingresos
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Egresos
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-1 sm:gap-2">
              {series.map((s) => (
                <div key={s.periodo} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 max-w-[18px] rounded-t bg-emerald-500/90"
                      style={{ height: `${(s.ingresos / maxBar) * 100}%` }}
                      title={`Ingresos ${periodLabel(s.periodo)}: ${fmtARS(s.ingresos)}`}
                    />
                    <div
                      className="w-1/2 max-w-[18px] rounded-t bg-red-400/90"
                      style={{ height: `${(s.egresos / maxBar) * 100}%` }}
                      title={`Egresos ${periodLabel(s.periodo)}: ${fmtARS(s.egresos)}`}
                    />
                  </div>
                  <span className="text-[10px] capitalize text-muted-foreground">
                    {shortLabel(s.periodo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detalle por mes */}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                  <th className="px-3 py-2 text-right font-medium">Equipo</th>
                  <th className="px-3 py-2 text-right font-medium">Gastos</th>
                  <th className="px-3 py-2 text-right font-medium">Margen</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((s) => {
                  const pct = s.ingresos > 0 ? Math.round((s.margen / s.ingresos) * 100) : 0;
                  const vacio = s.ingresos === 0 && s.egresos === 0;
                  return (
                    <tr
                      key={s.periodo}
                      className={cn("border-b last:border-0", vacio && "opacity-40")}
                    >
                      <td className="px-3 py-2 font-medium capitalize">
                        {periodLabel(s.periodo)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                        {fmtARS(s.ingresos)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtARS(s.equipo)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtARS(s.gastos)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          s.margen < 0 ? "text-red-600" : "text-emerald-600"
                        )}
                      >
                        {fmtARS(s.margen)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          pct < 0 ? "text-red-600" : "text-muted-foreground"
                        )}
                      >
                        {vacio ? "—" : `${pct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Cashflow real: cada cobro/pago se imputa al mes en que efectivamente
            entró o salió (fecha de cobro / pago), no al período del servicio.
            Montos en moneda extranjera al dólar blue actual ({fmtARS(rates.USD)}
            /USD), así que meses viejos son aproximados.
          </p>
        </>
      ) : (
        <>
          {/* Resumen del historial */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Entró" value={fmtARS(totalIn)} tone="in" />
            <SummaryCard label="Salió" value={fmtARS(totalOut)} tone="out" />
            <SummaryCard
              label="Neto"
              value={fmtARS(totalIn - totalOut)}
              tone={totalIn - totalOut >= 0 ? "in" : "out"}
            />
          </div>

          {/* Filtro por tipo */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "todos", label: "Todos", href: "/finanzas/movimientos" },
                { key: "in", label: "Ingresos", href: "/finanzas/movimientos?t=in" },
                { key: "out", label: "Egresos", href: "/finanzas/movimientos?t=out" },
              ] as const
            ).map((opt) => (
              <Link
                key={opt.key}
                href={opt.href}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filtro === opt.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {all.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Todavía no hay movimientos. Cobrá una factura o pagá un sueldo desde
                las páginas correspondientes y vas a verlo acá.
              </CardContent>
            </Card>
          ) : (
            Array.from(byMonth.entries()).map(([month, items]) => {
              const ingMonth = items
                .filter((m) => m.kind === "in")
                .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
              const egrMonth = items
                .filter((m) => m.kind === "out")
                .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
              const monthDate = new Date(month + "-01");
              return (
                <section key={month} className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <h2 className="text-base font-semibold capitalize">
                      {monthDate.toLocaleDateString("es-AR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-700">↓ {fmtARS(ingMonth)}</span>
                      <span className="text-amber-700">↑ {fmtARS(egrMonth)}</span>
                      <span
                        className={cn(
                          "font-semibold",
                          ingMonth - egrMonth >= 0 ? "text-foreground" : "text-red-700"
                        )}
                      >
                        Neto: {fmtARS(ingMonth - egrMonth)}
                      </span>
                    </div>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <ul className="divide-y">
                        {items.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-3 px-3 py-2 text-sm"
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                m.kind === "in"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              )}
                            >
                              {m.kind === "in" ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{m.contraparte}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {m.concepto}
                                {m.metodo && ` · ${m.metodo}`}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div
                                className={cn(
                                  "font-semibold tabular-nums",
                                  m.kind === "in" ? "text-emerald-700" : "text-amber-700"
                                )}
                              >
                                {m.kind === "in" ? "+" : "−"}
                                {fmtCurrency(m.monto, m.moneda)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(m.fecha).toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "in" | "out";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-bold tabular-nums sm:text-lg",
          tone === "in"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-amber-700 dark:text-amber-400"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  delta?: number;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      {delta !== undefined && delta !== 0 && (
        <div
          className={cn(
            "mt-0.5 flex items-center gap-0.5 text-[10px]",
            delta >= 0 ? "text-emerald-600" : "text-red-600"
          )}
        >
          {delta >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {fmtARS(Math.abs(delta))} vs mes anterior
        </div>
      )}
    </div>
  );
}
