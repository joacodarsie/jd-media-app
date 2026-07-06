import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Plus,
  Repeat,
  Users,
  Megaphone,
  HandCoins,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";
import { HelpTrigger } from "@/components/help-trigger";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import {
  currentPeriod,
  nextPeriod,
  periodLabel,
  toARS,
  fmtARS,
  fmtCurrency,
} from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { MonthPicker } from "@/components/month-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { ExpenseFormDialog } from "@/components/expense-form-dialog";
import { FinancialAdvisorCard, type AdviceData } from "@/components/financial-advisor-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CICLO_MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

interface InvoiceRow {
  id: string;
  monto: number;
  moneda: string;
  fecha_vencimiento: string | null;
  fecha_cobro: string | null;
  periodo: string;
  concepto: string;
  cliente: { id: string; nombre: string } | null;
}
interface PaymentRow {
  id: string;
  monto: number;
  moneda: string;
  fecha_programada: string;
  fecha_pago: string | null;
  periodo: string;
  concepto: string;
  usuario: { id: string; nombre: string } | null;
}
interface ExpenseRow {
  id: string;
  categoria: string;
  proveedor: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  periodo: string;
  fecha_programada: string | null;
  fecha_pago: string | null;
}
interface SubRow {
  costo: number;
  moneda: string;
  ciclo: string;
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const me = await requireFeature("finanzas");
  const isAdmin = me.rol === "admin";
  const supabase = createClient();
  const admin = createAdmin();
  const rates = await getExchangeRates();
  const period =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const mStart = `${period}-01`;
  const mEnd = `${nextPeriod(period)}-01`;

  const [
    { data: invoicesRaw },
    { data: paymentsRaw },
    { data: expensesRaw },
    { data: subsRaw },
    { data: adSpendRaw },
    { data: internalRaw },
    { data: debtsRaw },
    clientsData,
    usersData,
    payroll,
  ] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, monto, moneda, fecha_vencimiento, fecha_cobro, periodo, concepto, cliente:clients(id,nombre)"
      ),
    supabase
      .from("team_payments")
      .select(
        "id, monto, moneda, fecha_programada, fecha_pago, periodo, concepto, usuario:users!team_payments_user_id_fkey(id,nombre)"
      ),
    supabase
      .from("expenses")
      .select(
        "id, categoria, proveedor, concepto, monto, moneda, periodo, fecha_programada, fecha_pago"
      ),
    supabase.from("subscriptions").select("costo, moneda, ciclo").eq("activa", true),
    // Pauta de Meta del mes (la de JD Media = costo propio de la agencia).
    supabase
      .from("paid_media_snapshots")
      .select("cliente_id, spend, moneda, fecha")
      .gte("fecha", mStart)
      .lt("fecha", mEnd),
    supabase.from("clients").select("id").eq("es_interno", true),
    // Deudas activas (solo se muestran al admin). Privadas.
    isAdmin
      ? admin.from("debts").select("monto, moneda").eq("saldada", false)
      : Promise.resolve({ data: [] }),
    getActiveClients(),
    getActiveUsers(),
    buildPeriodPayroll(admin, period),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[];
  const expenses = (expensesRaw ?? []) as unknown as ExpenseRow[];
  const subs = (subsRaw ?? []) as SubRow[];
  const adSpend = (adSpendRaw ?? []) as { cliente_id: string; spend: number; moneda: string }[];
  const internalIds = new Set(((internalRaw ?? []) as { id: string }[]).map((c) => c.id));
  const clients = clientsData as { id: string; nombre: string }[];
  const users = usersData as { id: string; nombre: string }[];
  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);

  // ===== GANANCIA del mes = Ingresos − Sueldos − Plataformas − Publicidad =====
  // Ingresos del mes = lo efectivamente COBRADO en el período (facturas con
  // fecha de cobro dentro del mes). Varía mes a mes, coherente con la ganancia
  // real (antes mostraba el abono de los clientes de hoy, igual para todo mes).
  const ingresos = invoices
    .filter((i) => i.fecha_cobro && i.fecha_cobro.startsWith(period))
    .reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const sueldos = payroll.totalNomina;
  const plataformas = subs.reduce(
    (a, s) => a + ars(s.costo, s.moneda) / (CICLO_MESES[s.ciclo] ?? 1),
    0
  );
  // Publicidad propia: pauta de JD Media (cliente interno) del mes.
  const publicidad = adSpend
    .filter((x) => internalIds.has(x.cliente_id))
    .reduce((a, x) => a + ars(x.spend, x.moneda), 0);
  const ganancia = ingresos - sueldos - plataformas - publicidad;

  // Deudas (solo admin): total y meses para saldar al ritmo de ganancia actual.
  const deudaTotal = ((debtsRaw ?? []) as { monto: number; moneda: string }[]).reduce(
    (a, d) => a + ars(d.monto, d.moneda),
    0
  );
  const mesesParaSaldar = deudaTotal > 0 && ganancia > 0 ? Math.ceil(deudaTotal / ganancia) : null;

  // ===== Cashflow del mes (lo efectivamente movido) =====
  const pagadoEquipo = payments
    .filter((p) => p.fecha_pago && p.fecha_pago.startsWith(period))
    .reduce((a, p) => a + ars(p.monto, p.moneda), 0);

  // ===== Pendientes del mes (lo que falta para cerrar) =====
  const porCobrar = invoices
    .filter((i) => i.periodo === period && !i.fecha_cobro)
    .reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const porPagarEquipo = Math.max(0, sueldos - pagadoEquipo);
  const gastosPendMes = expenses
    .filter((e) => e.periodo === period && !e.fecha_pago)
    .reduce((a, e) => a + ars(e.monto, e.moneda), 0);

  // ===== Pendientes LIVE (para las tarjetas del día a día) =====
  const cobrosPend = invoices.filter((i) => !i.fecha_cobro);
  const cobrosVenc = cobrosPend.filter((i) => i.fecha_vencimiento && i.fecha_vencimiento < today);
  const cobros7d = cobrosPend.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento >= today && i.fecha_vencimiento <= in7
  );
  const totalPorCobrar = cobrosPend.reduce((a, i) => a + ars(i.monto, i.moneda), 0);

  const pagosPend = payments.filter((p) => !p.fecha_pago);
  const pagosAtras = pagosPend.filter((p) => p.fecha_programada < today);
  const pagos7d = pagosPend.filter(
    (p) => p.fecha_programada >= today && p.fecha_programada <= in7
  );
  const totalPorPagar = pagosPend.reduce((a, p) => a + ars(p.monto, p.moneda), 0);

  const gastosPend = expenses.filter((e) => !e.fecha_pago);
  const gastosAtras = gastosPend.filter((e) => e.fecha_programada && e.fecha_programada < today);
  const totalGastosPend = gastosPend.reduce((a, e) => a + ars(e.monto, e.moneda), 0);

  // Asesor financiero (solo admin). Resiliente si falta la migración 0102.
  let advice: AdviceData | null = null;
  if (isAdmin) {
    const { data: adviceRow } = await admin
      .from("financial_advice")
      .select("score, estado, fortalezas, riesgos, recomendaciones, generado_at")
      .eq("periodo", period)
      .maybeSingle();
    if (adviceRow) advice = adviceRow as unknown as AdviceData;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Finanzas
            <HelpTrigger slug="finanzas" label="Cómo funciona Finanzas" size="md" />
          </h1>
          <p className="text-muted-foreground">
            Cómo venís en <b className="capitalize">{periodLabel(period)}</b> — lo que entra,
            lo que sale y lo que queda.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/finanzas/cierre"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <ClipboardCheck className="h-4 w-4" /> Cerrar el mes
          </Link>
          <MonthPicker value={period} />
          <div className="rounded-lg border bg-card px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Dólar blue
            </div>
            <div className="text-sm font-bold tabular-nums">
              ARS {rates.USD.toLocaleString("es-AR")}
            </div>
          </div>
        </div>
      </div>

      {/* ===== PANEL PRINCIPAL: Tu ganancia del mes ===== */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Tu ganancia de {periodLabel(period)}
              </div>
              <div
                className={cn(
                  "text-4xl font-bold tabular-nums",
                  ganancia >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {fmtARS(ganancia)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Lo que te queda después de pagar todo. Cobrado del mes − sueldos − plataformas − publicidad.
              </div>
            </div>
            {/* Desglose */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Breakdown label="Cobrado" value={ingresos} sign="+" icon={TrendingUp} href="/finanzas/cobros" />
              <Breakdown label="Sueldos" value={sueldos} sign="−" icon={Users} href="/coordinacion/sueldos" />
              <Breakdown label="Plataformas" value={plataformas} sign="−" icon={Repeat} href="/finanzas/suscripciones" />
              <Breakdown label="Publicidad" value={publicidad} sign="−" icon={Megaphone} href="/paid-media" />
            </div>
          </div>

          {/* Lo que falta para cerrar el mes */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            {porCobrar > 0 && (
              <Link href="/finanzas/cobros" className="text-emerald-700 hover:underline dark:text-emerald-400">
                Falta cobrar {fmtARS(porCobrar)}
              </Link>
            )}
            {porPagarEquipo > 0 && (
              <Link href="/coordinacion/sueldos" className="text-amber-700 hover:underline dark:text-amber-400">
                Falta pagar al equipo {fmtARS(porPagarEquipo)}
              </Link>
            )}
            {gastosPendMes > 0 && (
              <Link href="/finanzas/gastos" className="text-orange-700 hover:underline dark:text-orange-400">
                Gastos por pagar {fmtARS(gastosPendMes)}
              </Link>
            )}
          </div>

          {/* Deudas (privado, solo admin): posición real */}
          {isAdmin && deudaTotal > 0 && (
            <Link
              href="/finanzas/deudas"
              className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300"
            >
              <HandCoins className="h-3.5 w-3.5" />
              Debés <b>{fmtARS(deudaTotal)}</b>
              {mesesParaSaldar != null && (
                <span className="text-red-600/80 dark:text-red-300/80">
                  · a este ritmo de ganancia lo saldás en ~{mesesParaSaldar}{" "}
                  {mesesParaSaldar === 1 ? "mes" : "meses"}
                </span>
              )}
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Asesor financiero con IA (solo admin) */}
      {isAdmin && <FinancialAdvisorCard period={period} advice={advice} />}

      {/* Alertas (vencidos / atrasados, todo el histórico) */}
      {(cobrosVenc.length > 0 || pagosAtras.length > 0 || gastosAtras.length > 0) && (
        <Card className="border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="space-y-1 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Atención
            </div>
            {cobrosVenc.length > 0 && (
              <Row
                href="/finanzas/cobros?f=vencidas"
                text={`${cobrosVenc.length} factura(s) vencida(s) sin cobrar`}
                amount={fmtARS(cobrosVenc.reduce((a, i) => a + ars(i.monto, i.moneda), 0))}
              />
            )}
            {pagosAtras.length > 0 && (
              <Row
                href="/finanzas/pagos?f=atrasados"
                text={`${pagosAtras.length} pago(s) atrasado(s) al equipo`}
                amount={fmtARS(pagosAtras.reduce((a, p) => a + ars(p.monto, p.moneda), 0))}
              />
            )}
            {gastosAtras.length > 0 && (
              <Row
                href="/finanzas/gastos?f=pendientes"
                text={`${gastosAtras.length} gasto(s) atrasado(s)`}
                amount={fmtARS(gastosAtras.reduce((a, e) => a + ars(e.monto, e.moneda), 0))}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Día a día ===== */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Día a día
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Section
            href="/finanzas/cobros"
            title="Cobrar"
            icon={TrendingUp}
            color="emerald"
            totalLabel="Por cobrar"
            totalARS={totalPorCobrar}
            listTitle="Vence en 7 días"
            listEmpty="Nada vence esta semana."
            listItems={cobros7d.slice(0, 4).map((i) => ({
              id: i.id,
              primary: i.cliente?.nombre ?? "—",
              secondary: i.concepto,
              amountLabel: fmtCurrency(Number(i.monto), i.moneda),
              dateLabel: i.fecha_vencimiento
                ? new Date(i.fecha_vencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
                : "—",
            }))}
            newButton={
              <InvoiceFormDialog
                mode="create"
                clients={clients}
                trigger={
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2">
                    <Plus className="h-3 w-3" /> Nueva
                  </Button>
                }
              />
            }
          />
          <Section
            href="/finanzas/pagos"
            title="Pagar al equipo"
            icon={TrendingDown}
            color="amber"
            totalLabel="Por pagar"
            totalARS={totalPorPagar}
            listTitle="Paga en 7 días"
            listEmpty="Nada se paga esta semana."
            listItems={pagos7d.slice(0, 4).map((p) => ({
              id: p.id,
              primary: p.usuario?.nombre ?? "—",
              secondary: p.concepto,
              amountLabel: fmtCurrency(Number(p.monto), p.moneda),
              dateLabel: new Date(p.fecha_programada).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
            }))}
            newButton={
              <PaymentFormDialog
                mode="create"
                users={users}
                clients={clients}
                trigger={
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2">
                    <Plus className="h-3 w-3" /> Nuevo
                  </Button>
                }
              />
            }
          />
          <Section
            href="/finanzas/gastos"
            title="Gastos"
            icon={Receipt}
            color="orange"
            totalLabel="Pendientes"
            totalARS={totalGastosPend}
            listTitle="Gastos del mes pagados"
            listEmpty="Sin gastos este mes."
            listItems={expenses
              .filter((e) => e.fecha_pago && e.fecha_pago.startsWith(period))
              .slice(0, 4)
              .map((e) => ({
                id: e.id,
                primary: e.proveedor ?? "—",
                secondary: e.concepto,
                amountLabel: fmtCurrency(Number(e.monto), e.moneda),
                dateLabel: e.fecha_pago
                  ? new Date(e.fecha_pago).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
                  : "—",
              }))}
            newButton={
              <ExpenseFormDialog
                mode="create"
                clients={clients}
                trigger={
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2">
                    <Plus className="h-3 w-3" /> Nuevo
                  </Button>
                }
              />
            }
          />
        </div>
      </div>

      {/* ===== Análisis (secundario, colapsado para no marear) ===== */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <span className="uppercase tracking-wide">Análisis detallado</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3">
          <AnalisisLink href="/finanzas/registro" title="Registro (Excel)" desc="Planilla mes a mes: entró, salió, neto y crecimiento. Ordenable y descargable a Excel." />
          <AnalisisLink href="/finanzas/movimientos" title="Movimientos" desc="Todo lo que entró y salió, con vista detalle o evolución del margen mes a mes." />
          <AnalisisLink href="/finanzas/rentabilidad" title="Rentabilidad por cliente" desc="Cuánto deja cada cuenta según cobros y gastos reales." />
          <AnalisisLink href="/finanzas/vencimientos" title="Vencimientos" desc="Qué pagás y cuándo: plataformas, equipo y gastos." />
          <AnalisisLink href="/finanzas/proyeccion" title="Proyección" desc="MRR, LTV y caja de los próximos meses." />
          <AnalisisLink href="/finanzas/suscripciones" title="Suscripciones" desc="Plataformas SaaS que paga la agencia." />
          <AnalisisLink href="/finanzas/recordatorios" title="Recordatorios de cobro" desc="Mensaje de WhatsApp por cliente, a un toque." />
          {isAdmin && (
            <AnalisisLink href="/finanzas/deudas" title="Deudas" desc="Lo que debés, para ver tu posición real. Privado." />
          )}
        </div>
      </details>
    </div>
  );
}

function Breakdown({
  label,
  value,
  sign,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  icon: typeof Wallet;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          sign === "+" ? "text-emerald-600" : "text-foreground"
        )}
      >
        {sign} {fmtARS(value)}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="transition-colors hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Row({ href, text, amount }: { href: string; text: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>
        {text} (<b>{amount}</b>)
      </span>
      <Link href={href} className="text-xs underline hover:no-underline">
        Ver
      </Link>
    </div>
  );
}

function AnalisisLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
    >
      <div className="font-semibold">{title} →</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}

interface SectionListItem {
  id: string;
  primary: string;
  secondary: string;
  amountLabel: string;
  dateLabel: string;
}

function Section({
  href,
  title,
  icon: Icon,
  color,
  totalARS,
  totalLabel,
  listTitle,
  listItems,
  listEmpty,
  newButton,
}: {
  href: string;
  title: string;
  icon: typeof Wallet;
  color: "emerald" | "amber" | "orange";
  totalARS: number;
  totalLabel: string;
  listTitle: string;
  listItems: SectionListItem[];
  listEmpty: string;
  newButton: React.ReactNode;
}) {
  const accent: Record<typeof color, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  };
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="flex items-center gap-3 hover:opacity-80">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accent[color])}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{totalLabel}</div>
              <div className="text-xl font-bold tabular-nums">{fmtARS(totalARS)}</div>
              <div className="inline-flex items-center gap-1 text-xs underline">
                {title} <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
          <div>{newButton}</div>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {listTitle}
          </div>
          {listItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">{listEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {listItems.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.primary}</div>
                    <div className="truncate text-xs text-muted-foreground">{it.secondary}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold">{it.amountLabel}</div>
                    <div className="text-[10px] text-muted-foreground">{it.dateLabel}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
