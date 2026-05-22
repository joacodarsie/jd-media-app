import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Plus,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import {
  currentPeriod,
  periodLabel,
  toARS,
  fmtARS,
  fmtCurrency,
} from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { ExpenseFormDialog } from "@/components/expense-form-dialog";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function FinanzasPage() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();
  const period = currentPeriod();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  const [
    { data: invoicesRaw },
    { data: paymentsRaw },
    { data: expensesRaw },
    { data: clientsData },
    { data: usersData },
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
    supabase.from("clients").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[];
  const expenses = (expensesRaw ?? []) as unknown as ExpenseRow[];
  const clients = (clientsData ?? []) as { id: string; nombre: string }[];
  const users = (usersData ?? []) as { id: string; nombre: string }[];

  // ===== Cashflow real del mes (fecha_cobro / fecha_pago) =====
  const cobradoMes = invoices
    .filter((i) => i.fecha_cobro && i.fecha_cobro.startsWith(period))
    .reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0);
  const pagadoEquipoMes = payments
    .filter((p) => p.fecha_pago && p.fecha_pago.startsWith(period))
    .reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0);
  const pagadoGastosMes = expenses
    .filter((e) => e.fecha_pago && e.fecha_pago.startsWith(period))
    .reduce((a, e) => a + toARS(Number(e.monto), e.moneda, rates), 0);
  const margenReal = cobradoMes - pagadoEquipoMes - pagadoGastosMes;

  // ===== Pendientes (independiente del mes) =====
  const cobrosPend = invoices.filter((i) => !i.fecha_cobro);
  const cobrosVenc = cobrosPend.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento < today
  );
  const cobros7d = cobrosPend.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento >= today && i.fecha_vencimiento <= in7
  );
  const totalPorCobrar = cobrosPend.reduce(
    (a, i) => a + toARS(Number(i.monto), i.moneda, rates),
    0
  );

  const pagosPend = payments.filter((p) => !p.fecha_pago);
  const pagosAtras = pagosPend.filter((p) => p.fecha_programada < today);
  const pagos7d = pagosPend.filter(
    (p) => p.fecha_programada >= today && p.fecha_programada <= in7
  );
  const totalPorPagar = pagosPend.reduce(
    (a, p) => a + toARS(Number(p.monto), p.moneda, rates),
    0
  );

  const gastosPend = expenses.filter((e) => !e.fecha_pago);
  const gastosAtras = gastosPend.filter(
    (e) => e.fecha_programada && e.fecha_programada < today
  );
  const totalGastosPend = gastosPend.reduce(
    (a, e) => a + toARS(Number(e.monto), e.moneda, rates),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">
            Cashflow de {periodLabel(period)} — lo que entró/salió este mes.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Dólar blue
          </div>
          <div className="text-lg font-bold tabular-nums">
            ARS {rates.USD.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {rates.source === "live" ? "dolarapi.com · hoy" : "fallback"}
          </div>
        </div>
      </div>

      {/* Margen real del mes — protagonista */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg",
                  margenReal >= 0
                    ? "bg-primary/15 text-foreground"
                    : "bg-red-100 text-red-700"
                )}
              >
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Margen REAL de {periodLabel(period)}
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  {fmtARS(margenReal)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Lo que entró menos lo que salió en el mes.{" "}
                  <span className="text-foreground/70">
                    No depende del período del servicio.
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="↓ Cobrado" value={cobradoMes} color="emerald" />
              <Stat label="↑ Pagado equipo" value={pagadoEquipoMes} color="amber" />
              <Stat label="↑ Gastos" value={pagadoGastosMes} color="orange" />
            </div>
          </div>
          <p className="mt-3 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
            <b>Ejemplo:</b> si el cliente paga mayo en abril, ese cobro aparece
            en abril. Si vos pagás el sueldo de mayo en junio, ese pago aparece
            en junio. Esta vista muestra cashflow real.
          </p>
        </CardContent>
      </Card>

      {/* Alertas */}
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
                amount={fmtARS(
                  cobrosVenc.reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0)
                )}
              />
            )}
            {pagosAtras.length > 0 && (
              <Row
                href="/finanzas/pagos?f=atrasados"
                text={`${pagosAtras.length} pago(s) atrasado(s) al equipo`}
                amount={fmtARS(
                  pagosAtras.reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0)
                )}
              />
            )}
            {gastosAtras.length > 0 && (
              <Row
                href="/finanzas/gastos?f=pendientes"
                text={`${gastosAtras.length} gasto(s) atrasado(s)`}
                amount={fmtARS(
                  gastosAtras.reduce((a, e) => a + toARS(Number(e.monto), e.moneda, rates), 0)
                )}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 3 cards: Cobros / Pagos equipo / Gastos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          href="/finanzas/cobros"
          title="Cuentas por cobrar"
          icon={TrendingUp}
          color="emerald"
          totalLabel="Pendiente total"
          totalARS={totalPorCobrar}
          subKpis={[
            { label: "Cobrado este mes", value: cobradoMes },
            { label: "Vence en 7 días", value: cobros7d.length, isCount: true },
          ]}
          listTitle="Próximos 7 días"
          listEmpty="Nada vence en esta semana."
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
          title="Pagos al equipo"
          icon={TrendingDown}
          color="amber"
          totalLabel="Pendiente total"
          totalARS={totalPorPagar}
          subKpis={[
            { label: "Pagado este mes", value: pagadoEquipoMes },
            { label: "Paga en 7 días", value: pagos7d.length, isCount: true },
          ]}
          listTitle="Próximos 7 días"
          listEmpty="Nada se paga en esta semana."
          listItems={pagos7d.slice(0, 4).map((p) => ({
            id: p.id,
            primary: p.usuario?.nombre ?? "—",
            secondary: p.concepto,
            amountLabel: fmtCurrency(Number(p.monto), p.moneda),
            dateLabel: new Date(p.fecha_programada).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
            }),
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
          title="Gastos operativos"
          icon={Receipt}
          color="orange"
          totalLabel="Pendiente total"
          totalARS={totalGastosPend}
          subKpis={[
            { label: "Pagado este mes", value: pagadoGastosMes },
            { label: "Pendientes", value: gastosPend.length, isCount: true },
          ]}
          listTitle="Gastos del mes pagados"
          listEmpty="Sin gastos cargados este mes."
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/finanzas/rentabilidad"
          className="rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
        >
          <div className="font-semibold">Rentabilidad por cliente →</div>
          <div className="text-xs text-muted-foreground">
            Cuánto deja cada cliente neto.
          </div>
        </Link>
        <Link
          href="/finanzas/movimientos"
          className="rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
        >
          <div className="font-semibold">Movimientos →</div>
          <div className="text-xs text-muted-foreground">
            Historial unificado de cobros y pagos.
          </div>
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "orange";
}) {
  const cls: Record<typeof color, string> = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    orange: "text-orange-700 dark:text-orange-400",
  };
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", cls[color])}>
        {fmtARS(value)}
      </div>
    </div>
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

interface SectionListItem {
  id: string;
  primary: string;
  secondary: string;
  amountLabel: string;
  dateLabel: string;
}

interface SubKpi {
  label: string;
  value: number;
  isCount?: boolean;
}

function Section({
  href,
  title,
  icon: Icon,
  color,
  totalARS,
  totalLabel,
  subKpis,
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
  subKpis: SubKpi[];
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

        <div className="grid grid-cols-2 gap-2">
          {subKpis.map((k, i) => (
            <div key={i} className="rounded-md border bg-card px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {k.isCount ? k.value : fmtARS(k.value)}
              </div>
            </div>
          ))}
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
