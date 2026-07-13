import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, periodLabel, prevPeriod, nextPeriod, toARS, toARSFijos } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { getExchangeRates } from "@/lib/exchange";
import { PanoramaAgencia, type PanoramaData } from "@/components/panorama-agencia";

export const dynamic = "force-dynamic";

const CICLO_MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

export default async function PanoramaPage({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const periodo = searchParams.periodo ?? currentPeriod();

  const [
    rates,
    payroll,
    { data: clientsRaw },
    { data: svcRaw },
    { data: subsRaw },
    { data: usersRaw },
    { data: invoicesRaw },
    { data: teamPayRaw },
    { data: expensesRaw },
  ] = await Promise.all([
    getExchangeRates(),
    buildPeriodPayroll(admin, periodo),
    admin
      .from("clients")
      .select("id, nombre, coordinador_id, cm_id, disenador_id, audiovisual_id")
      .eq("estado", "activo")
      .eq("es_interno", false),
    admin
      .from("client_services")
      .select("id, cliente_id, tipo, monto_mensual, moneda, facturacion, costo_override, created_at")
      .eq("activo", true),
    admin
      .from("subscriptions")
      .select("id, nombre, categoria, costo, moneda, ciclo, activa, notas")
      .order("moneda")
      .order("costo", { ascending: false }),
    admin.from("users").select("id, nombre").eq("activo", true),
    // Lo REAL del período: facturas, pagos al equipo y gastos.
    admin.from("client_invoices").select("monto, moneda, fecha_cobro").eq("periodo", periodo),
    admin.from("team_payments").select("monto, moneda, fecha_pago").eq("periodo", periodo),
    admin.from("expenses").select("monto, moneda, fecha_pago").eq("periodo", periodo),
  ]);

  const uname = new Map((usersRaw ?? []).map((u) => [u.id, u.nombre]));
  const svcByClient = new Map<string, typeof svcRaw>();
  for (const s of svcRaw ?? []) {
    if (!svcByClient.has(s.cliente_id)) svcByClient.set(s.cliente_id, []);
    svcByClient.get(s.cliente_id)!.push(s);
  }

  // ── Cuentas: abono de gestión de redes (editable) + extras (branding, etc.) ──
  const cuentas: PanoramaData["cuentas"] = [];
  let ingresosRecurrentes = 0;
  let ingresosExtraordinarios = 0;
  for (const c of clientsRaw ?? []) {
    const ss = svcByClient.get(c.id) ?? [];
    const gestion = ss.find((s) => s.tipo === "gestion_redes" && s.facturacion !== "unico");
    const abono = gestion ? Number(gestion.monto_mensual) || 0 : 0;
    ingresosRecurrentes += abono;

    // Servicios de cobro único (branding, proyectos): ingreso extraordinario
    // SOLO del mes en que se cargaron (misma regla que la nómina) — si no, un
    // branding de abril inflaría los ingresos de todos los meses siguientes.
    const extra = ss
      .filter(
        (s) => s.facturacion === "unico" && (s.created_at ?? "").slice(0, 7) === periodo
      )
      .reduce((a, s) => a + (Number(s.monto_mensual) || 0), 0);
    ingresosExtraordinarios += extra;

    // Equipo faltante: una cuenta con gestión de redes que factura pero no tiene
    // CM / diseñador / editor asignado no genera esos costos en la nómina, así
    // que su margen se ve inflado. Los acuerdos fijos cubren todo con un monto,
    // así que no aplican.
    const faltaEquipo: string[] = [];
    if (gestion && gestion.costo_override == null && abono > 0) {
      if (!c.cm_id) faltaEquipo.push("CM");
      if (!c.disenador_id) faltaEquipo.push("diseño");
      if (!c.audiovisual_id) faltaEquipo.push("edición");
    }

    cuentas.push({
      clienteId: c.id,
      nombre: c.nombre,
      serviceId: gestion?.id ?? null,
      abono,
      extra,
      coordinador: c.coordinador_id ? uname.get(c.coordinador_id) ?? null : null,
      acuerdoFijo: gestion?.costo_override != null,
      faltaEquipo,
    });
  }
  cuentas.sort((a, b) => b.abono - a.abono);

  // ── Costos fijos (suscripciones) mensualizados a ARS ──
  const fijos: PanoramaData["fijos"] = (subsRaw ?? []).map((s) => {
    const mensualOrigen = Number(s.costo) / (CICLO_MESES[s.ciclo] ?? 1);
    return {
      id: s.id,
      nombre: s.nombre,
      categoria: s.categoria,
      costo: Number(s.costo),
      moneda: s.moneda,
      ciclo: s.ciclo,
      activa: s.activa,
      montoMensualARS: s.activa ? toARSFijos(mensualOrigen, s.moneda, rates) : 0,
    };
  });
  const costosFijos = fijos.reduce((a, f) => a + f.montoMensualARS, 0);

  // ── Lo REAL del período: cobrado / pagado vs lo que el modelo dice ──
  type MoneyRow = { monto: number; moneda: string };
  const sum = (rows: (MoneyRow & { done: boolean })[], done: boolean) =>
    rows.filter((r) => r.done === done).reduce((a, r) => a + toARS(Number(r.monto), r.moneda, rates), 0);
  const invoices = ((invoicesRaw ?? []) as { monto: number; moneda: string; fecha_cobro: string | null }[]).map(
    (r) => ({ ...r, done: !!r.fecha_cobro })
  );
  const teamPays = ((teamPayRaw ?? []) as { monto: number; moneda: string; fecha_pago: string | null }[]).map(
    (r) => ({ ...r, done: !!r.fecha_pago })
  );
  // Gastos: los pagados en USD ya quedaron congelados en ARS; los pendientes se
  // estiman al cripto (toARSFijos).
  const gastos = ((expensesRaw ?? []) as { monto: number; moneda: string; fecha_pago: string | null }[]);
  const gastosPagados = gastos
    .filter((g) => g.fecha_pago)
    .reduce((a, g) => a + toARSFijos(Number(g.monto), g.moneda, rates), 0);
  const real = {
    cobrado: sum(invoices, true),
    porCobrar: sum(invoices, false),
    equipoPagado: sum(teamPays, true),
    equipoPendiente: sum(teamPays, false),
    gastosPagados,
  };

  const data: PanoramaData = {
    periodo,
    usd: rates.USDC,
    usdSource: rates.source,
    ingresosRecurrentes,
    ingresosExtraordinarios,
    costosOperativos: payroll.totalNomina,
    costosFijos,
    cuentas,
    fijos,
    real,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/finanzas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Panorama de la agencia</h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/finanzas/panorama?periodo=${prevPeriod(periodo)}`}
              className="rounded-md border p-1.5 hover:bg-muted"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-[130px] text-center text-sm font-semibold capitalize">
              {periodLabel(periodo)}
            </span>
            <Link
              href={`/finanzas/panorama?periodo=${nextPeriod(periodo)}`}
              className="rounded-md border p-1.5 hover:bg-muted"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <p className="mt-1 text-muted-foreground">
          Los números reales todos juntos: cuánto entra, cuánto sale (equipo +
          costos fijos) y qué te queda. Editá los abonos y los fijos acá mismo.
          El equipo de diseño y edición se paga por contenido publicado, así que
          un mes en curso todavía muestra ese costo incompleto — mirá un mes
          cerrado para comparar.
        </p>
      </div>
      <PanoramaAgencia data={data} />
    </div>
  );
}
