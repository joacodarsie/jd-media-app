import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import {
  currentPeriod,
  nextPeriod,
  periodLabel,
  toARS,
  fmtARS,
  fmtCurrency,
} from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { InvoiceFormDialog } from "@/components/invoice-form-dialog";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

export default async function FinanzasPage() {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();
  const period = currentPeriod();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  const [
    { data: invoicesRaw },
    { data: paymentsRaw },
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
    supabase.from("clients").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[];
  const clients = (clientsData ?? []) as { id: string; nombre: string }[];
  const users = (usersData ?? []) as { id: string; nombre: string }[];

  // ===== Cobros =====
  const cobrosPend = invoices.filter((i) => !i.fecha_cobro);
  const cobrosVenc = cobrosPend.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento < today
  );
  const cobros7d = cobrosPend.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento >= today && i.fecha_vencimiento <= in7
  );
  const cobrosMes = cobrosPend.filter((i) => i.periodo === period);
  const totalPorCobrarARS = cobrosPend.reduce(
    (a, i) => a + toARS(Number(i.monto), i.moneda, rates),
    0
  );
  const cobradoMes = invoices
    .filter((i) => i.fecha_cobro && i.fecha_cobro.startsWith(period))
    .reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0);

  // ===== Pagos =====
  const pagosPend = payments.filter((p) => !p.fecha_pago);
  const pagosAtras = pagosPend.filter((p) => p.fecha_programada < today);
  const pagos7d = pagosPend.filter(
    (p) => p.fecha_programada >= today && p.fecha_programada <= in7
  );
  const totalPorPagarARS = pagosPend.reduce(
    (a, p) => a + toARS(Number(p.monto), p.moneda, rates),
    0
  );
  const pagadoMes = payments
    .filter((p) => p.fecha_pago && p.fecha_pago.startsWith(period))
    .reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0);

  const margenReal = cobradoMes - pagadoMes;

  const periodoNext = nextPeriod(period);
  const haInvoicesNext = invoices.some((i) => i.periodo === periodoNext);
  const hayPaymentsNext = payments.some((p) => p.periodo === periodoNext);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">
            Resumen de {periodLabel(period)}.
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

      {/* Alertas arriba si las hay */}
      {(cobrosVenc.length > 0 || pagosAtras.length > 0) && (
        <Card className="border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="space-y-1 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Atención
            </div>
            {cobrosVenc.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <b>{cobrosVenc.length}</b> factura(s) vencida(s) sin cobrar (
                  {fmtARS(
                    cobrosVenc.reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0)
                  )}
                  )
                </span>
                <Link
                  href="/finanzas/cobros?f=vencidas"
                  className="text-xs underline hover:no-underline"
                >
                  Ver
                </Link>
              </div>
            )}
            {pagosAtras.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <b>{pagosAtras.length}</b> pago(s) atrasado(s) al equipo (
                  {fmtARS(
                    pagosAtras.reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0)
                  )}
                  )
                </span>
                <Link
                  href="/finanzas/pagos?f=atrasados"
                  className="text-xs underline hover:no-underline"
                >
                  Ver
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2 cards grandes: cobros / pagos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          href="/finanzas/cobros"
          title="Cuentas por cobrar"
          icon={TrendingUp}
          color="emerald"
          totalLabel="Pendiente total"
          totalARS={totalPorCobrarARS}
          subKpis={[
            { label: "Cobrado este mes", value: cobradoMes, color: "emerald" },
            { label: "Vence en 7 días", value: cobros7d.length, isCount: true },
          ]}
          listTitle="Próximos 7 días"
          listEmpty="Nada vence en esta semana."
          listItems={cobros7d.slice(0, 5).map((i) => ({
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
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" /> Nueva factura
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
          totalARS={totalPorPagarARS}
          subKpis={[
            { label: "Pagado este mes", value: pagadoMes, color: "amber" },
            { label: "Pago en 7 días", value: pagos7d.length, isCount: true },
          ]}
          listTitle="Próximos 7 días"
          listEmpty="Nada se paga en esta semana."
          listItems={pagos7d.slice(0, 5).map((p) => ({
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
              trigger={
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" /> Nuevo pago
                </Button>
              }
            />
          }
        />
      </div>

      {/* Margen real del mes */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                margenReal >= 0
                  ? "bg-primary/15 text-foreground"
                  : "bg-red-100 text-red-700"
              )}
            >
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Margen real de {periodLabel(period)} (cobrado − pagado)
              </div>
              <div className="text-2xl font-bold tabular-nums">{fmtARS(margenReal)}</div>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>↓ cobrado {fmtARS(cobradoMes)}</span>
            <span>↑ pagado {fmtARS(pagadoMes)}</span>
            <Link
              href="/finanzas/movimientos"
              className="ml-2 inline-flex items-center gap-1 underline hover:no-underline"
            >
              Ver movimientos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Generar mes */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Generar período {periodLabel(periodoNext)}
          </div>
          <p className="text-xs text-muted-foreground">
            Crea automáticamente las facturas (por cada servicio mensual activo) y los
            pagos recurrentes del equipo. <b>No duplica</b> si ya generaste.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <GenerateMonthButton kind="invoices" />
            <GenerateMonthButton kind="payments" />
            <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
              {haInvoicesNext && <span className="text-emerald-700">✓ facturas listas</span>}
              {hayPaymentsNext && <span className="text-emerald-700">✓ pagos listos</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tip ventas únicas */}
      {cobrosMes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          <b>Tip:</b> para ventas puntuales (un diseño suelto, etiquetas, una pieza
          única) usá <b>“Nueva factura”</b>. Para servicios mensuales recurrentes usá <b>“Generar mes”</b>.
        </p>
      )}
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
  color?: "emerald" | "amber";
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
  color: "emerald" | "amber";
  totalARS: number;
  totalLabel: string;
  subKpis: SubKpi[];
  listTitle: string;
  listItems: SectionListItem[];
  listEmpty: string;
  newButton: React.ReactNode;
}) {
  const accent =
    color === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{totalLabel}</div>
              <div className="text-2xl font-bold tabular-nums">{fmtARS(totalARS)}</div>
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-xs underline hover:no-underline"
              >
                {title} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div>{newButton}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {subKpis.map((k, i) => (
            <div key={i} className="rounded-md border bg-card px-3 py-2">
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
