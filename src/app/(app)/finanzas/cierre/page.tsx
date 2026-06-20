import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Receipt,
  Repeat,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, currentPeriod, periodLabel } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { MonthPicker } from "@/components/month-picker";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface InvRow {
  monto: number;
  moneda: string;
  fecha_cobro: string | null;
}
interface PayRow {
  monto: number;
  moneda: string;
  fecha_pago: string | null;
}
interface ExpRow {
  monto: number;
  moneda: string;
  fecha_pago: string | null;
}
interface SubRow {
  costo: number;
  moneda: string;
  ciclo: string;
  proxima_renovacion: string | null;
}

export default async function CierreMesPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const admin = createAdmin();
  const rates = await getExchangeRates();
  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();

  const [{ data: invRaw }, { data: payRaw }, { data: expRaw }, { data: subRaw }, payroll] =
    await Promise.all([
      admin
        .from("client_invoices")
        .select("monto, moneda, fecha_cobro")
        .eq("periodo", periodo),
      admin
        .from("team_payments")
        .select("monto, moneda, fecha_pago")
        .eq("periodo", periodo),
      admin
        .from("expenses")
        .select("monto, moneda, fecha_pago")
        .eq("periodo", periodo),
      admin
        .from("subscriptions")
        .select("costo, moneda, ciclo, proxima_renovacion")
        .eq("activa", true),
      buildPeriodPayroll(admin, periodo),
    ]);

  const invoices = (invRaw ?? []) as InvRow[];
  const payments = (payRaw ?? []) as PayRow[];
  const expenses = (expRaw ?? []) as ExpRow[];
  const subs = (subRaw ?? []) as SubRow[];
  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);

  // ── Cobros del mes ──
  const cobrosTotal = invoices.reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const cobrado = invoices
    .filter((i) => i.fecha_cobro)
    .reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const porCobrar = cobrosTotal - cobrado;
  const cobrosPendCount = invoices.filter((i) => !i.fecha_cobro).length;

  // ── Equipo: nómina CALCULADA del mes vs lo ya pagado/registrado ──
  const nominaCalculada = payroll.totalNomina;
  const pagadoEquipo = payments
    .filter((p) => p.fecha_pago)
    .reduce((a, p) => a + ars(p.monto, p.moneda), 0);
  // Pendiente al equipo: lo que falta para cubrir la nómina calculada.
  const porPagarEquipo = Math.max(0, nominaCalculada - pagadoEquipo);

  // ── Gastos del mes ──
  const gastosTotal = expenses.reduce((a, e) => a + ars(e.monto, e.moneda), 0);
  const gastosPagado = expenses
    .filter((e) => e.fecha_pago)
    .reduce((a, e) => a + ars(e.monto, e.moneda), 0);
  const gastosPend = gastosTotal - gastosPagado;

  // ── Suscripciones que renuevan en el mes ──
  const subsMes = subs
    .filter((s) => (s.proxima_renovacion ?? "").slice(0, 7) === periodo)
    .reduce((a, s) => a + ars(s.costo, s.moneda), 0);

  // ── Neto ──
  const egresoRealizado = pagadoEquipo + gastosPagado;
  const netoRealizado = cobrado - egresoRealizado;
  const egresoEsperado = nominaCalculada + gastosTotal + subsMes;
  const netoProyectado = cobrosTotal - egresoEsperado;

  const todoCobrado = cobrosPendCount === 0 && cobrosTotal > 0;
  const todoPagado = porPagarEquipo <= 0 && gastosPend <= 0;

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cierre de mes</h1>
          <p className="max-w-2xl text-muted-foreground">
            Todo lo de <b className="capitalize">{periodLabel(periodo)}</b> en una
            pantalla: lo que entró y lo que falta cobrar, contra la nómina del equipo,
            los gastos y las suscripciones. El neto del mes, de un vistazo.
          </p>
        </div>
        <MonthPicker value={periodo} />
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cobrado" value={fmtARS(cobrado)} tone="good" icon={TrendingUp} />
        <Kpi
          label="Pagado (equipo + gastos)"
          value={fmtARS(egresoRealizado)}
          tone="bad"
          icon={TrendingDown}
        />
        <Kpi
          label="Neto realizado"
          value={fmtARS(netoRealizado)}
          tone={netoRealizado >= 0 ? "good" : "bad"}
          icon={Wallet}
        />
        <Kpi
          label="Neto proyectado"
          value={fmtARS(netoProyectado)}
          sub="si se cobra y paga todo"
          tone={netoProyectado >= 0 ? "good" : "bad"}
        />
      </div>

      {/* Estado de cierre */}
      <div className="grid gap-3 sm:grid-cols-2">
        <EstadoCard
          ok={todoCobrado}
          okText="Cobraste todo lo del mes 🎉"
          pendText={`Falta cobrar ${fmtARS(porCobrar)} (${cobrosPendCount} factura${
            cobrosPendCount === 1 ? "" : "s"
          })`}
          href="/finanzas/cobros"
          emptyText={cobrosTotal === 0 ? "No hay facturas cargadas para este mes." : undefined}
        />
        <EstadoCard
          ok={todoPagado}
          okText="Equipo y gastos al día ✅"
          pendText={`Falta pagar ${fmtARS(porPagarEquipo + gastosPend)} (equipo ${fmtARS(
            porPagarEquipo
          )} · gastos ${fmtARS(gastosPend)})`}
          href="/coordinacion/sueldos"
        />
      </div>

      {/* Detalle por bloque */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque
          icon={TrendingUp}
          color="emerald"
          title="Cobros del mes"
          href="/finanzas/cobros"
          rows={[
            { label: "Total a cobrar", value: cobrosTotal, strong: true },
            { label: "Cobrado", value: cobrado, tone: "good" },
            { label: "Pendiente", value: porCobrar, tone: porCobrar > 0 ? "bad" : undefined },
          ]}
        />
        <Bloque
          icon={Users}
          color="amber"
          title="Equipo (nómina del mes)"
          href="/coordinacion/sueldos"
          rows={[
            { label: "Nómina calculada", value: nominaCalculada, strong: true },
            { label: "Pagado / registrado", value: pagadoEquipo, tone: "good" },
            { label: "Pendiente", value: porPagarEquipo, tone: porPagarEquipo > 0 ? "bad" : undefined },
          ]}
        />
        <Bloque
          icon={Receipt}
          color="orange"
          title="Gastos del mes"
          href="/finanzas/gastos"
          rows={[
            { label: "Total", value: gastosTotal, strong: true },
            { label: "Pagado", value: gastosPagado, tone: "good" },
            { label: "Pendiente", value: gastosPend, tone: gastosPend > 0 ? "bad" : undefined },
          ]}
        />
        <Bloque
          icon={Repeat}
          color="violet"
          title="Suscripciones que renuevan"
          href="/finanzas/suscripciones"
          rows={[{ label: "Renovaciones del mes", value: subsMes, strong: true }]}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        💡 La <b>nómina calculada</b> es lo que el modelo dice que tenés que pagarle al
        equipo este mes (tarifas + comisiones + servicios). El <b>pagado/registrado</b>
        sale de los pagos al equipo del mes. Cobros, gastos y suscripciones son en ARS al
        blue de hoy ({fmtARS(rates.USD)}/USD).
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  icon?: typeof Wallet;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
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
    </div>
  );
}

function EstadoCard({
  ok,
  okText,
  pendText,
  href,
  emptyText,
}: {
  ok: boolean;
  okText: string;
  pendText: string;
  href: string;
  emptyText?: string;
}) {
  if (emptyText) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
        ok
          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-amber-300 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
      )}
      <span className={ok ? "text-emerald-800 dark:text-emerald-200" : "font-medium"}>
        {ok ? okText : pendText}
      </span>
    </Link>
  );
}

function Bloque({
  icon: Icon,
  color,
  title,
  href,
  rows,
}: {
  icon: typeof Wallet;
  color: "emerald" | "amber" | "orange" | "violet";
  title: string;
  href: string;
  rows: { label: string; value: number; strong?: boolean; tone?: "good" | "bad" }[];
}) {
  const accent: Record<typeof color, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <Link href={href} className="mb-3 flex items-center gap-2 hover:opacity-80">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
        </Link>
        <dl className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <dt className={cn("text-muted-foreground", r.strong && "font-medium text-foreground")}>
                {r.label}
              </dt>
              <dd
                className={cn(
                  "tabular-nums",
                  r.strong && "font-semibold",
                  r.tone === "good" && "text-emerald-600",
                  r.tone === "bad" && "text-red-600"
                )}
              >
                {fmtARS(r.value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
