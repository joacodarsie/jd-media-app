import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Users,
  Bell,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { currentPeriod, periodLabel, toARS, fmtARS } from "@/lib/finanzas";
import { MonthPicker } from "@/components/month-picker";
import { MonthCloseGenerateButton } from "@/components/month-close-generate-button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CierreMesPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const admin = createAdmin();
  const rates = await getExchangeRates();
  const period =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();
  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);

  const [{ data: clientsRaw }, { data: svcRaw }, { data: invRaw }, { data: payRaw }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id, nombre")
        .eq("estado", "activo")
        .eq("es_interno", false),
      admin
        .from("client_services")
        .select("cliente_id, monto_mensual, facturacion, activo")
        .eq("activo", true),
      admin
        .from("client_invoices")
        .select("cliente_id, monto, moneda, fecha_cobro")
        .eq("periodo", period),
      admin
        .from("team_payments")
        .select("user_id, monto, moneda, fecha_pago")
        .eq("periodo", period),
    ]);

  const clients = (clientsRaw ?? []) as { id: string; nombre: string }[];
  const activeIds = new Set(clients.map((c) => c.id));
  const svcs = (svcRaw ?? []) as {
    cliente_id: string;
    monto_mensual: number | null;
    facturacion: string | null;
  }[];
  const invoices = (invRaw ?? []) as {
    cliente_id: string;
    monto: number;
    moneda: string;
    fecha_cobro: string | null;
  }[];
  const payments = (payRaw ?? []) as {
    user_id: string;
    monto: number;
    moneda: string;
    fecha_pago: string | null;
  }[];

  // ===== Paso 1: cobros del mes generados =====
  // Clientes que deberían facturarse: activos con un servicio mensual con monto.
  const billableIds = new Set(
    svcs
      .filter(
        (s) =>
          activeIds.has(s.cliente_id) &&
          (s.facturacion ?? "mensual") !== "unico" &&
          s.monto_mensual != null
      )
      .map((s) => s.cliente_id)
  );
  const invoicedIds = new Set(invoices.map((i) => i.cliente_id));
  const facturados = [...billableIds].filter((id) => invoicedIds.has(id)).length;
  const totalBillable = billableIds.size;
  const step1Done = totalBillable > 0 && facturados >= totalBillable;

  // ===== Paso 2: pagos del equipo generados =====
  const pagosGenerados = payments.length;
  const step2Done = pagosGenerados > 0;

  // ===== Paso 4: cobrar (marcar cobrado) =====
  const invTotal = invoices.length;
  const invCobradas = invoices.filter((i) => i.fecha_cobro).length;
  const totalPorCobrar = invoices
    .filter((i) => !i.fecha_cobro)
    .reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const cobrado = invoices
    .filter((i) => i.fecha_cobro)
    .reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const step4Done = invTotal > 0 && invCobradas >= invTotal;

  // ===== Paso 5: pagar al equipo (marcar pagado) =====
  const payTotal = payments.length;
  const payPagadas = payments.filter((p) => p.fecha_pago).length;
  const totalPorPagar = payments
    .filter((p) => !p.fecha_pago)
    .reduce((a, p) => a + ars(p.monto, p.moneda), 0);
  const pagado = payments
    .filter((p) => p.fecha_pago)
    .reduce((a, p) => a + ars(p.monto, p.moneda), 0);
  const step5Done = payTotal > 0 && payPagadas >= payTotal;

  const pasosHechos = [step1Done, step2Done, step4Done, step5Done].filter(Boolean).length;
  const totalPasosAuto = 4; // los medibles (el de recordatorios es manual)
  const progreso = Math.round((pasosHechos / totalPasosAuto) * 100);

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
          <h1 className="text-2xl font-bold">Cerrar el mes</h1>
          <p className="text-muted-foreground">
            Todo el cierre de <b className="capitalize">{periodLabel(period)}</b> en
            un solo lugar: generás los cobros y los pagos, mandás los recordatorios
            y vas marcando lo cobrado y lo pagado.
          </p>
        </div>
        <MonthPicker value={period} />
      </div>

      {/* Progreso general */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {pasosHechos} de {totalPasosAuto} pasos listos
            </span>
            <span className="text-muted-foreground">{progreso}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Step
        n={1}
        done={step1Done}
        icon={FileText}
        title="Generar los cobros del mes"
        desc={
          totalBillable === 0
            ? "No hay clientes activos con abono mensual cargado."
            : `${facturados} de ${totalBillable} clientes con abono ya tienen su cobro de ${periodLabel(period)}.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthCloseGenerateButton
              kind="invoices"
              periodo={period}
              label={step1Done ? "Regenerar faltantes" : "Generar cobros"}
            />
            <StepLink href={`/finanzas/cobros?m=${period}`}>Ver cobros</StepLink>
          </div>
        }
      />

      <Step
        n={2}
        done={step2Done}
        icon={Users}
        title="Generar los pagos del equipo (sueldos)"
        desc={
          step2Done
            ? `${pagosGenerados} pago(s) del equipo generados para ${periodLabel(period)}.`
            : "Todavía no generaste los pagos del equipo de este mes."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthCloseGenerateButton
              kind="payments"
              periodo={period}
              label={step2Done ? "Regenerar faltantes" : "Generar pagos"}
            />
            <StepLink href="/coordinacion/sueldos">Ver sueldos</StepLink>
          </div>
        }
      />

      <Step
        n={3}
        done={false}
        manual
        icon={Bell}
        title="Mandar los recordatorios de cobro"
        desc="Mensaje de WhatsApp listo para cada cliente con su monto. Este paso es manual, se marca solo cuando lo hacés."
        action={<StepLink href={`/finanzas/recordatorios?m=${period}`}>Ir a recordatorios</StepLink>}
      />

      <Step
        n={4}
        done={step4Done}
        icon={TrendingUp}
        title="Marcar lo que te van pagando"
        desc={
          invTotal === 0
            ? "Todavía no hay cobros generados este mes (hacé el paso 1)."
            : `${invCobradas} de ${invTotal} cobrados · cobrado ${fmtARS(cobrado)}${totalPorCobrar > 0 ? ` · falta ${fmtARS(totalPorCobrar)}` : ""}.`
        }
        action={<StepLink href={`/finanzas/cobros?f=pendientes&m=${period}`}>Marcar cobrado</StepLink>}
      />

      <Step
        n={5}
        done={step5Done}
        icon={TrendingDown}
        title="Pagar al equipo y marcarlo"
        desc={
          payTotal === 0
            ? "Todavía no hay pagos generados este mes (hacé el paso 2)."
            : `${payPagadas} de ${payTotal} pagados · pagado ${fmtARS(pagado)}${totalPorPagar > 0 ? ` · falta ${fmtARS(totalPorPagar)}` : ""}.`
        }
        action={<StepLink href="/finanzas/pagos?f=pendientes">Marcar pagado</StepLink>}
      />

      {pasosHechos === totalPasosAuto && (
        <Card className="border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="flex items-center gap-2 p-4 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <Check className="h-5 w-5" /> Mes cerrado: cobros y pagos generados,
            todo cobrado y pagado. ¡Listo!
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
    >
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function Step({
  n,
  done,
  manual,
  icon: Icon,
  title,
  desc,
  action,
}: {
  n: number;
  done: boolean;
  manual?: boolean;
  icon: typeof FileText;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <Card className={cn(done && "border-emerald-300 dark:border-emerald-900")}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done
              ? "bg-emerald-500 text-white"
              : manual
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
          )}
        >
          {done ? <Check className="h-5 w-5" /> : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
          <div className="mt-2">{action}</div>
        </div>
      </CardContent>
    </Card>
  );
}
