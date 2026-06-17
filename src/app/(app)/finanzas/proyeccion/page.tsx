import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  CalendarClock,
  Repeat,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import {
  toARS,
  fmtARS,
  currentPeriod,
  nextPeriod,
  prevPeriod,
  periodLabel,
} from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TREND_MONTHS = 12; // ventana hacia atrás para el ramp del MRR
const FORECAST_MONTHS = 3; // ventana hacia adelante para la caja

interface SvcRow {
  cliente_id: string;
  monto_mensual: number | null;
  moneda: string;
  activo: boolean;
  facturacion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}
interface ClientRow {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
}
interface InvRow {
  monto: number;
  moneda: string;
  fecha_vencimiento: string | null;
  fecha_cobro: string | null;
}
interface PayRow {
  monto: number;
  moneda: string;
  fecha_programada: string;
  fecha_pago: string | null;
}
interface ExpRow {
  monto: number;
  moneda: string;
  fecha_programada: string | null;
  fecha_pago: string | null;
}
interface SubRow {
  costo: number;
  moneda: string;
  ciclo: string;
  proxima_renovacion: string | null;
  activa: boolean;
}

// Cuántos meses cubre cada ciclo de suscripción.
const CICLO_MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

export default async function ProyeccionPage() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  const period = currentPeriod();
  const today = new Date().toISOString().slice(0, 10);

  // Ventana hacia atrás (ramp) y hacia adelante (caja).
  const backMonths: string[] = [];
  let bp = period;
  for (let i = 0; i < TREND_MONTHS; i++) {
    backMonths.unshift(bp);
    bp = prevPeriod(bp);
  }
  const fwdMonths: string[] = [];
  let fp = period;
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    fwdMonths.push(fp);
    fp = nextPeriod(fp);
  }
  const fwdSet = new Set(fwdMonths);

  const [clientsRes, svcRes, invRes, payRes, expRes, subRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, fecha_inicio")
      .eq("es_interno", false),
    supabase
      .from("client_services")
      .select("cliente_id, monto_mensual, moneda, activo, facturacion, fecha_inicio, fecha_fin"),
    supabase
      .from("client_invoices")
      .select("monto, moneda, fecha_vencimiento, fecha_cobro"),
    supabase
      .from("team_payments")
      .select("monto, moneda, fecha_programada, fecha_pago"),
    supabase
      .from("expenses")
      .select("monto, moneda, fecha_programada, fecha_pago"),
    supabase
      .from("subscriptions")
      .select("costo, moneda, ciclo, proxima_renovacion, activa")
      .eq("activa", true),
  ]);

  const clients = (clientsRes.data ?? []) as ClientRow[];
  const svcs = (svcRes.data ?? []) as SvcRow[];
  const invoices = (invRes.data ?? []) as InvRow[];
  const payments = (payRes.data ?? []) as PayRow[];
  const expenses = (expRes.data ?? []) as ExpRow[];
  const subs = (subRes.data ?? []) as SubRow[];

  const clientById = new Map(clients.map((c) => [c.id, c]));

  // ===== Servicios recurrentes activos = base del MRR =====
  const recurring = svcs.filter(
    (s) =>
      s.activo &&
      s.monto_mensual != null &&
      (s.facturacion ?? "mensual") === "mensual"
  );

  // ===== 1) MRR hoy =====
  const mrrByClient = new Map<string, number>();
  for (const s of recurring) {
    const ars = toARS(Number(s.monto_mensual), s.moneda, rates);
    mrrByClient.set(s.cliente_id, (mrrByClient.get(s.cliente_id) ?? 0) + ars);
  }
  const mrrHoy = [...mrrByClient.values()].reduce((a, v) => a + v, 0);
  const cuentas = mrrByClient.size;
  const arpa = cuentas > 0 ? mrrHoy / cuentas : 0;

  // ===== 2) Evolución del MRR (ramp a precios de hoy) =====
  // Una cuenta suma su monto actual a un mes M si arrancó en/antes de M y no terminó antes.
  const monthEnd = (m: string) => `${nextPeriod(m)}-01`; // exclusivo
  const trend = backMonths.map((m) => {
    const end = monthEnd(m);
    let mrr = 0;
    for (const s of recurring) {
      const inicio = s.fecha_inicio ?? clientById.get(s.cliente_id)?.fecha_inicio ?? null;
      // Si no hay fecha de inicio, asumimos que ya estaba (cuenta vieja).
      const arrancoAntes = !inicio || inicio < end;
      const terminoDespues = !s.fecha_fin || s.fecha_fin >= `${m}-01`;
      if (arrancoAntes && terminoDespues) {
        mrr += toARS(Number(s.monto_mensual), s.moneda, rates);
      }
    }
    return { mes: m, mrr };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => t.mrr));
  const mrrPrev = trend.length >= 2 ? trend[trend.length - 2].mrr : 0;
  const mrrDelta = mrrHoy - mrrPrev;
  // Comparación a 12 meses (primer mes con MRR > 0).
  const firstNonZero = trend.find((t) => t.mrr > 0);
  const mrrYearAgo = firstNonZero ? firstNonZero.mrr : 0;

  // ===== 3) LTV / antigüedad =====
  // Antigüedad de las cuentas activas (desde fecha_inicio del servicio o del cliente).
  const now = new Date();
  const monthsBetween = (from: string) => {
    const d = new Date(from);
    return Math.max(
      0,
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    );
  };
  const activeClientIds = [...mrrByClient.keys()];
  const tenures: number[] = [];
  const perClientValue: { id: string; nombre: string; meses: number; mrr: number; acum: number }[] = [];
  for (const cid of activeClientIds) {
    // El inicio más temprano entre sus servicios recurrentes activos.
    const starts = recurring
      .filter((s) => s.cliente_id === cid)
      .map((s) => s.fecha_inicio ?? clientById.get(cid)?.fecha_inicio ?? null)
      .filter((x): x is string => !!x);
    const inicio =
      starts.length > 0
        ? starts.reduce((a, b) => (a < b ? a : b))
        : clientById.get(cid)?.fecha_inicio ?? null;
    const meses = inicio ? monthsBetween(inicio) + 1 : 1; // +1 = mes en curso cuenta
    const mrr = mrrByClient.get(cid) ?? 0;
    tenures.push(meses);
    perClientValue.push({
      id: cid,
      nombre: clientById.get(cid)?.nombre ?? "—",
      meses,
      mrr,
      acum: meses * mrr,
    });
  }
  const antiguedadProm =
    tenures.length > 0 ? tenures.reduce((a, v) => a + v, 0) / tenures.length : 0;
  const ltv = arpa * antiguedadProm; // valor realizado promedio por cuenta (piso, siguen activas)
  perClientValue.sort((a, b) => b.acum - a.acum);

  // ===== 4) Proyección de caja (próximos meses) =====
  const monthKey = (d: string | null) => (d ? d.slice(0, 7) : null);
  type CashRow = { mes: string; cobrar: number; pagar: number };
  const cash = new Map<string, CashRow>();
  for (const m of fwdMonths) cash.set(m, { mes: m, cobrar: 0, pagar: 0 });

  // Entradas: facturas pendientes (sin cobrar) por mes de vencimiento.
  let cobrarVencido = 0;
  for (const i of invoices) {
    if (i.fecha_cobro) continue;
    const ars = toARS(Number(i.monto), i.moneda, rates);
    const m = monthKey(i.fecha_vencimiento);
    if (i.fecha_vencimiento && i.fecha_vencimiento < today) {
      cobrarVencido += ars; // ya venció, debería entrar igual → lo sumamos al primer mes
      cash.get(fwdMonths[0])!.cobrar += ars;
    } else if (m && fwdSet.has(m)) {
      cash.get(m)!.cobrar += ars;
    }
  }
  // Para meses futuros sin facturas generadas todavía, proyectar el MRR.
  for (const m of fwdMonths) {
    const row = cash.get(m)!;
    if (row.cobrar === 0 && m !== period) {
      row.cobrar = mrrHoy; // expectativa según cartera activa
    }
  }

  // Salidas: pagos al equipo + gastos programados (pendientes) por mes.
  let pagarAtrasado = 0;
  for (const p of payments) {
    if (p.fecha_pago) continue;
    const ars = toARS(Number(p.monto), p.moneda, rates);
    const m = monthKey(p.fecha_programada);
    if (p.fecha_programada < today) {
      pagarAtrasado += ars;
      cash.get(fwdMonths[0])!.pagar += ars;
    } else if (m && fwdSet.has(m)) {
      cash.get(m)!.pagar += ars;
    }
  }
  for (const e of expenses) {
    if (e.fecha_pago || !e.fecha_programada) continue;
    const ars = toARS(Number(e.monto), e.moneda, rates);
    const m = monthKey(e.fecha_programada);
    if (e.fecha_programada < today) {
      pagarAtrasado += ars;
      cash.get(fwdMonths[0])!.pagar += ars;
    } else if (m && fwdSet.has(m)) {
      cash.get(m)!.pagar += ars;
    }
  }
  // Suscripciones: proyectar renovaciones dentro de la ventana según ciclo.
  let subsMensual = 0;
  for (const s of subs) {
    const ars = toARS(Number(s.costo), s.moneda, rates);
    const paso = CICLO_MESES[s.ciclo] ?? 1;
    subsMensual += ars / paso; // costo prorrateado mensual (para KPI)
    if (!s.proxima_renovacion) continue;
    // Avanzar desde la próxima renovación sumando el ciclo hasta salir de la ventana.
    let r = s.proxima_renovacion.slice(0, 7);
    let guard = 0;
    while (guard++ < 24) {
      if (fwdSet.has(r)) cash.get(r)!.pagar += ars;
      // avanzar `paso` meses
      for (let k = 0; k < paso; k++) r = nextPeriod(r);
      if (r > fwdMonths[fwdMonths.length - 1]) break;
    }
  }

  const cashRows = fwdMonths.map((m) => {
    const r = cash.get(m)!;
    return { ...r, neto: r.cobrar - r.pagar };
  });
  let saldo = 0;
  const cashWithSaldo = cashRows.map((r) => {
    saldo += r.neto;
    return { ...r, saldo };
  });
  const maxCash = Math.max(1, ...cashRows.flatMap((r) => [r.cobrar, r.pagar]));

  const shortLabel = (per: string) => {
    const [y, m] = per.split("-").map(Number);
    return new Date(y, m - 1, 1)
      .toLocaleDateString("es-AR", { month: "short" })
      .replace(".", "");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/finanzas"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Finanzas
        </Link>
        <h1 className="text-2xl font-bold">Proyección financiera</h1>
        <p className="max-w-2xl text-muted-foreground">
          Tu ingreso recurrente (MRR), cómo creció, cuánto vale una cuenta en el tiempo
          y la <b>caja proyectada</b> de los próximos meses. Todo en ARS al blue de hoy
          ({fmtARS(rates.USD)}/USD).
        </p>
      </div>

      {/* ===== KPIs MRR ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="MRR actual"
          value={fmtARS(mrrHoy)}
          tone="good"
          delta={mrrDelta}
          sub={`${cuentas} cuentas activas`}
        />
        <Kpi label="Ingreso promedio / cuenta" value={fmtARS(arpa)} sub="ARPA" />
        <Kpi label="Proyección anual" value={fmtARS(mrrHoy * 12)} tone="good" sub="al ritmo actual" />
        <Kpi
          label="Costo fijo de plataformas"
          value={fmtARS(subsMensual)}
          tone="bad"
          sub="suscripciones / mes"
        />
      </div>

      {/* ===== Evolución del MRR ===== */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Evolución del MRR
          </h2>
          {mrrYearAgo > 0 && mrrYearAgo !== mrrHoy && (
            <span
              className={cn(
                "text-xs font-medium",
                mrrHoy >= mrrYearAgo ? "text-emerald-600" : "text-red-600"
              )}
            >
              {mrrHoy >= mrrYearAgo ? "▲" : "▼"}{" "}
              {Math.round(((mrrHoy - mrrYearAgo) / mrrYearAgo) * 100)}% desde{" "}
              {shortLabel(firstNonZero!.mes)}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between gap-1 sm:gap-2">
          {trend.map((t) => (
            <div key={t.mes} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-36 w-full items-end justify-center">
                <div
                  className="w-2/3 max-w-[28px] rounded-t bg-emerald-500/90"
                  style={{ height: `${(t.mrr / maxTrend) * 100}%` }}
                  title={`MRR ${periodLabel(t.mes)}: ${fmtARS(t.mrr)}`}
                />
              </div>
              <span className="text-[10px] capitalize text-muted-foreground">
                {shortLabel(t.mes)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          MRR reconstruido con las cuentas <b>activas hoy</b>, ubicadas según cuándo
          arrancó cada una y a precios actuales. Muestra el crecimiento de la cartera;
          no descuenta cuentas que se dieron de baja en el pasado.
        </p>
      </div>

      {/* ===== LTV / antigüedad ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" /> Valor de una cuenta
            </h2>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Antigüedad promedio
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {antiguedadProm.toFixed(1)} <span className="text-base font-normal">meses</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                LTV estimado
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600">
                {fmtARS(ltv)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                ARPA × antigüedad promedio (piso: las cuentas siguen activas).
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="border-b px-4 py-2.5 text-sm font-semibold">
              Valor acumulado por cuenta
            </div>
            {perClientValue.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No hay cuentas activas con MRR.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-muted/60 text-left text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2 text-right">Antig.</th>
                      <th className="px-3 py-2 text-right">MRR</th>
                      <th className="px-3 py-2 text-right">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perClientValue.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Link href={`/clientes/${r.id}`} className="font-medium hover:underline">
                            {r.nombre}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                          {r.meses}m
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                          {fmtARS(r.mrr)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {fmtARS(r.acum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Proyección de caja ===== */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Proyección de caja —
          próximos {FORECAST_MONTHS} meses
        </h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Cobros pendientes (por vencimiento) vs pagos y gastos programados +
          renovación de suscripciones. Lo vencido/atrasado se imputa a{" "}
          {periodLabel(fwdMonths[0])}. Los meses sin facturas generadas usan el MRR
          actual como expectativa.
        </p>

        {(cobrarVencido > 0 || pagarAtrasado > 0) && (
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            {cobrarVencido > 0 && (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                {fmtARS(cobrarVencido)} por cobrar ya vencido
              </span>
            )}
            {pagarAtrasado > 0 && (
              <span className="rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {fmtARS(pagarAtrasado)} por pagar atrasado
              </span>
            )}
          </div>
        )}

        {/* Barras cobrar vs pagar */}
        <div className="flex items-end justify-around gap-4">
          {cashWithSaldo.map((r) => (
            <div key={r.mes} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-1/3 max-w-[26px] rounded-t bg-emerald-500/90"
                  style={{ height: `${(r.cobrar / maxCash) * 100}%` }}
                  title={`Por cobrar: ${fmtARS(r.cobrar)}`}
                />
                <div
                  className="w-1/3 max-w-[26px] rounded-t bg-red-400/90"
                  style={{ height: `${(r.pagar / maxCash) * 100}%` }}
                  title={`Por pagar: ${fmtARS(r.pagar)}`}
                />
              </div>
              <span className="text-[10px] capitalize text-muted-foreground">
                {shortLabel(r.mes)}
              </span>
            </div>
          ))}
        </div>

        {/* Tabla caja */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Mes</th>
                <th className="px-3 py-2 text-right font-medium">Por cobrar</th>
                <th className="px-3 py-2 text-right font-medium">Por pagar</th>
                <th className="px-3 py-2 text-right font-medium">Neto</th>
                <th className="px-3 py-2 text-right font-medium">Saldo acum.</th>
              </tr>
            </thead>
            <tbody>
              {cashWithSaldo.map((r) => (
                <tr key={r.mes} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium capitalize">{periodLabel(r.mes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                    {fmtARS(r.cobrar)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {fmtARS(r.pagar)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      r.neto < 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {fmtARS(r.neto)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      r.saldo < 0 ? "text-red-600" : "text-foreground"
                    )}
                  >
                    {fmtARS(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Por cobrar
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Por pagar
          </span>
          <span className="flex items-center gap-1">
            <Repeat className="h-3 w-3" /> incluye suscripciones
          </span>
        </div>
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
