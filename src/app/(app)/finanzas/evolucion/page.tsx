import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, currentPeriod, prevPeriod, periodLabel } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTHS = 12;

interface MonthRow {
  periodo: string;
  ingresos: number;
  equipo: number;
  gastos: number;
  egresos: number;
  margen: number;
}

export default async function EvolucionPage() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  // Ventana de los últimos 12 meses (clave YYYY-MM).
  const periods: string[] = [];
  let p = currentPeriod();
  for (let i = 0; i < MONTHS; i++) {
    periods.unshift(p);
    p = prevPeriod(p);
  }
  const firstMonth = periods[0];

  const [{ data: invoices }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("client_invoices").select("monto, moneda, fecha_cobro").not("fecha_cobro", "is", null),
    supabase.from("team_payments").select("monto, moneda, fecha_pago").not("fecha_pago", "is", null),
    supabase.from("expenses").select("monto, moneda, fecha_pago").not("fecha_pago", "is", null),
  ]);

  const blank = (): MonthRow => ({
    periodo: "",
    ingresos: 0,
    equipo: 0,
    gastos: 0,
    egresos: 0,
    margen: 0,
  });
  const map = new Map<string, MonthRow>();
  for (const per of periods) map.set(per, { ...blank(), periodo: per });

  const monthOf = (d: string | null) => (d ? d.slice(0, 7) : null);
  for (const i of invoices ?? []) {
    const m = monthOf(i.fecha_cobro as string | null);
    if (m && map.has(m)) map.get(m)!.ingresos += toARS(Number(i.monto), i.moneda as string, rates);
  }
  for (const pay of payments ?? []) {
    const m = monthOf(pay.fecha_pago as string | null);
    if (m && map.has(m)) map.get(m)!.equipo += toARS(Number(pay.monto), pay.moneda as string, rates);
  }
  for (const e of expenses ?? []) {
    const m = monthOf(e.fecha_pago as string | null);
    if (m && map.has(m)) map.get(m)!.gastos += toARS(Number(e.monto), e.moneda as string, rates);
  }

  const series = periods.map((per) => {
    const r = map.get(per)!;
    r.egresos = r.equipo + r.gastos;
    r.margen = r.ingresos - r.egresos;
    return r;
  });

  const maxBar = Math.max(1, ...series.map((s) => Math.max(s.ingresos, s.egresos)));
  const conMov = series.filter((s) => s.ingresos > 0 || s.egresos > 0);
  const totalIngresos = series.reduce((a, s) => a + s.ingresos, 0);
  const totalEgresos = series.reduce((a, s) => a + s.egresos, 0);
  const margenTotal = totalIngresos - totalEgresos;
  const margenProm = conMov.length ? conMov.reduce((a, s) => a + s.margen, 0) / conMov.length : 0;
  const ultimo = series[series.length - 1];
  const anterior = series[series.length - 2];
  const delta = ultimo && anterior ? ultimo.margen - anterior.margen : 0;

  const shortLabel = (per: string) => {
    const [y, m] = per.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/finanzas"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Finanzas
        </Link>
        <h1 className="text-2xl font-bold">Evolución financiera</h1>
        <p className="text-muted-foreground">
          Cómo evolucionó el cashflow real de la agencia en los últimos {MONTHS}{" "}
          meses (por fecha de cobro / pago, todo en ARS al blue de hoy).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Margen ${periodLabel(ultimo.periodo)}`}
          value={fmtARS(ultimo.margen)}
          tone={ultimo.margen >= 0 ? "good" : "bad"}
          delta={delta}
        />
        <Kpi label="Margen promedio" value={fmtARS(margenProm)} sub={`${conMov.length} meses con movimiento`} />
        <Kpi label="Ingresos 12m" value={fmtARS(totalIngresos)} tone="good" />
        <Kpi label="Margen acumulado 12m" value={fmtARS(margenTotal)} tone={margenTotal >= 0 ? "good" : "bad"} />
      </div>

      {/* Gráfico de barras: ingresos vs egresos por mes */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Ingresos vs egresos por mes</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ingresos</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Egresos</span>
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
              <span className="text-[10px] capitalize text-muted-foreground">{shortLabel(s.periodo)}</span>
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
                <tr key={s.periodo} className={cn("border-b last:border-0", vacio && "opacity-40")}>
                  <td className="px-3 py-2 font-medium capitalize">{periodLabel(s.periodo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtARS(s.ingresos)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtARS(s.equipo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtARS(s.gastos)}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", s.margen < 0 ? "text-red-600" : "text-emerald-600")}>
                    {fmtARS(s.margen)}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", pct < 0 ? "text-red-600" : "text-muted-foreground")}>
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
        entró o salió (fecha de cobro / pago), no al período del servicio. Montos
        en moneda extranjera convertidos al dólar blue actual ({fmtARS(rates.USD)}
        /USD), así que meses viejos son aproximados. Desde {periodLabel(firstMonth)}.
      </p>
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
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
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
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {fmtARS(Math.abs(delta))} vs mes anterior
        </div>
      )}
    </div>
  );
}
