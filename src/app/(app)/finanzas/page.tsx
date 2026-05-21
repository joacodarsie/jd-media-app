import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Clock,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";

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

  const [{ data: invoicesRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, monto, moneda, fecha_vencimiento, fecha_cobro, periodo, concepto, cliente:clients(id,nombre)"
      )
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
    supabase
      .from("team_payments")
      .select(
        "id, monto, moneda, fecha_programada, fecha_pago, periodo, concepto, usuario:users!team_payments_user_id_fkey(id,nombre)"
      )
      .order("fecha_programada", { ascending: true }),
  ]);

  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[];

  // ===== Por cobrar =====
  const porCobrarPendientes = invoices.filter((i) => !i.fecha_cobro);
  const porCobrarVencidas = porCobrarPendientes.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento < today
  );
  const porCobrar7Dias = porCobrarPendientes.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento >= today && i.fecha_vencimiento <= in7
  );
  const porCobrarMes = porCobrarPendientes.filter((i) => i.periodo === period);
  const totalPorCobrar = porCobrarPendientes.reduce(
    (acc, i) => acc + toARS(Number(i.monto), i.moneda, rates),
    0
  );

  const cobradoMes = invoices
    .filter((i) => i.fecha_cobro && i.fecha_cobro.startsWith(period))
    .reduce((acc, i) => acc + toARS(Number(i.monto), i.moneda, rates), 0);

  // ===== Por pagar =====
  const porPagarPendientes = payments.filter((p) => !p.fecha_pago);
  const porPagarAtrasados = porPagarPendientes.filter(
    (p) => p.fecha_programada < today
  );
  const porPagar7Dias = porPagarPendientes.filter(
    (p) => p.fecha_programada >= today && p.fecha_programada <= in7
  );
  const porPagarMes = porPagarPendientes.filter((p) => p.periodo === period);
  const totalPorPagar = porPagarPendientes.reduce(
    (acc, p) => acc + toARS(Number(p.monto), p.moneda, rates),
    0
  );

  const pagadoMes = payments
    .filter((p) => p.fecha_pago && p.fecha_pago.startsWith(period))
    .reduce((acc, p) => acc + toARS(Number(p.monto), p.moneda, rates), 0);

  const margenMesReal = cobradoMes - pagadoMes;
  const margenMesProyectado =
    cobradoMes +
    porCobrarMes.reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0) -
    pagadoMes -
    porPagarMes.reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0);

  const periodoNext = nextPeriod(period);
  const haInvoicesNext = invoices.some((i) => i.periodo === periodoNext);
  const hayPaymentsNext = payments.some((p) => p.periodo === periodoNext);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">
            Resumen de {periodLabel(period)} · panel privado de admin.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Dólar blue {rates.source === "live" ? "(hoy)" : "(fallback)"}
          </div>
          <div className="text-lg font-bold tabular-nums">
            ARS {rates.USD.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {rates.source === "live" ? "dolarapi.com" : "API caída"}
          </div>
        </div>
      </div>

      {/* Subsecciones */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SubsectionCard
          href="/finanzas/cobros"
          title="Cuentas por cobrar"
          subtitle={`${porCobrarPendientes.length} pendientes · ${fmtARS(totalPorCobrar)}`}
          alert={porCobrarVencidas.length}
        />
        <SubsectionCard
          href="/finanzas/pagos"
          title="Pagos al equipo"
          subtitle={`${porPagarPendientes.length} pendientes · ${fmtARS(totalPorPagar)}`}
          alert={porPagarAtrasados.length}
        />
        <SubsectionCard
          href="/finanzas/movimientos"
          title="Movimientos"
          subtitle="Historial unificado"
        />
      </div>

      {/* KPIs del mes */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Este mes ({periodLabel(period)})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Cobrado" value={cobradoMes} icon={TrendingUp} color="emerald" />
          <Kpi label="Por cobrar" value={porCobrarMes.reduce((a, i) => a + toARS(Number(i.monto), i.moneda, rates), 0)} icon={Clock} color="sky" />
          <Kpi label="Pagado" value={pagadoMes} icon={TrendingDown} color="amber" />
          <Kpi label="Por pagar" value={porPagarMes.reduce((a, p) => a + toARS(Number(p.monto), p.moneda, rates), 0)} icon={Clock} color="orange" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Kpi
            label="Margen real (cobrado − pagado)"
            value={margenMesReal}
            icon={Wallet}
            color={margenMesReal >= 0 ? "primary" : "red"}
            size="lg"
          />
          <Kpi
            label="Margen proyectado del mes"
            value={margenMesProyectado}
            icon={Wallet}
            color={margenMesProyectado >= 0 ? "primary" : "red"}
            size="lg"
            subtitle="(si cobrás todo y pagás todo)"
          />
        </div>
      </div>

      {/* Alertas */}
      {(porCobrarVencidas.length > 0 || porPagarAtrasados.length > 0) && (
        <Card className="border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {porCobrarVencidas.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <b className="text-red-700 dark:text-red-300">
                    {porCobrarVencidas.length}
                  </b>{" "}
                  factura(s) vencida(s) sin cobrar (
                  {fmtARS(
                    porCobrarVencidas.reduce(
                      (a, i) => a + toARS(Number(i.monto), i.moneda, rates),
                      0
                    )
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
            {porPagarAtrasados.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <b className="text-red-700 dark:text-red-300">
                    {porPagarAtrasados.length}
                  </b>{" "}
                  pago(s) atrasado(s) al equipo (
                  {fmtARS(
                    porPagarAtrasados.reduce(
                      (a, p) => a + toARS(Number(p.monto), p.moneda, rates),
                      0
                    )
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

      {/* Próximos 7 días */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por cobrar (próx 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {porCobrar7Dias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada vence en esta semana.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {porCobrar7Dias.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{i.cliente?.nombre}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {i.concepto}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">
                        {fmtCurrency(Number(i.monto), i.moneda)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        vence{" "}
                        {i.fecha_vencimiento &&
                          new Date(i.fecha_vencimiento).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por pagar (próx 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {porPagar7Dias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada se paga en esta semana.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {porPagar7Dias.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.usuario?.nombre}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.concepto}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">
                        {fmtCurrency(Number(p.monto), p.moneda)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(p.fecha_programada).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generar mes siguiente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Generar período {periodLabel(periodoNext)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Crea automáticamente las facturas (por cliente con servicio activo) y los
            pagos (por miembro con compensación recurrente) del mes siguiente. No
            duplica si ya generaste.
          </p>
          <div className="flex flex-wrap gap-2">
            <GenerateMonthButton kind="invoices" />
            <GenerateMonthButton kind="payments" />
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              {haInvoicesNext && <span>✓ facturas generadas</span>}
              {hayPaymentsNext && <span>✓ pagos generados</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubsectionCard({
  href,
  title,
  subtitle,
  alert,
}: {
  href: string;
  title: string;
  subtitle: string;
  alert?: number;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {alert !== undefined && alert > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="h-3 w-3" />
          {alert} con alerta
        </div>
      )}
    </Link>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
  size = "md",
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  color: "emerald" | "amber" | "sky" | "orange" | "primary" | "red";
  subtitle?: string;
  size?: "md" | "lg";
}) {
  const accent: Record<typeof color, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    primary: "bg-primary/15 text-foreground",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`tabular-nums font-bold ${size === "lg" ? "text-2xl" : "text-xl"}`}>
            {fmtARS(value)}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
