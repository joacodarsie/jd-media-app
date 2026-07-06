import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import {
  mergeSettings,
  productionBase,
  mbCost,
  serviceDeliveryCost,
  standaloneDesignCost,
  type AgencySettings,
  type RatePack,
} from "@/lib/coordinacion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RATE_PACKS: string[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];
function asPack(p: string | null): RatePack {
  return p && RATE_PACKS.includes(p) ? (p as RatePack) : "Personalizado";
}

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  nombre: string;
  estado: string;
}

interface InvRow {
  cliente_id: string;
  monto: number;
  moneda: string;
  fecha_cobro: string | null;
  periodo: string;
}

interface ExpRow {
  cliente_id: string | null;
  monto: number;
  moneda: string;
  fecha_pago: string | null;
  fecha_programada: string | null;
  periodo: string;
}

interface PayRow {
  cliente_id: string | null;
  monto: number;
  moneda: string;
  fecha_pago: string | null;
  fecha_programada: string;
  periodo: string;
}

interface ServiceRow {
  cliente_id: string;
  monto_mensual: number | null;
  moneda: string;
  activo: boolean;
  tipo: string;
  pack: string | null;
  facturacion: string | null;
  pack_detalle: Record<string, number> | null;
  costo_override: number | null;
  costo_pct: number | null;
  costo_override_user: string | null;
}

export default async function RentabilidadPage({
  searchParams,
}: {
  searchParams: { mode?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  // mode: "cashflow" (default) = solo plata movida realmente
  // mode: "devengado" = todo lo facturado / programado, sin importar si cobró/pagó
  const mode = searchParams.mode === "devengado" ? "devengado" : "cashflow";

  const admin = createAdmin();
  const [clientsRes, invRes, expRes, payRes, svcRes, settingsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, estado")
      .eq("es_interno", false)
      .eq("estado", "activo")
      .order("nombre"),
    supabase
      .from("client_invoices")
      .select("cliente_id, monto, moneda, fecha_cobro, periodo"),
    supabase
      .from("expenses")
      .select("cliente_id, monto, moneda, fecha_pago, fecha_programada, periodo"),
    supabase
      .from("team_payments")
      .select("cliente_id, monto, moneda, fecha_pago, fecha_programada, periodo"),
    supabase
      .from("client_services")
      .select(
        "cliente_id, monto_mensual, moneda, activo, tipo, pack, facturacion, pack_detalle, costo_override, costo_pct, costo_override_user"
      )
      .eq("activo", true),
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
  ]);

  const settings: AgencySettings = mergeSettings(
    settingsRes.data as Partial<AgencySettings> | null
  );
  const clients = (clientsRes.data ?? []) as ClientRow[];
  const invs = (invRes.data ?? []) as InvRow[];
  const exps = (expRes.data ?? []) as ExpRow[];
  const pays = (payRes.data ?? []) as PayRow[];
  const svcs = (svcRes.data ?? []) as ServiceRow[];

  // Agrego por cliente
  const byClient = new Map<
    string,
    { ingresos: number; egresosEquipo: number; egresosGastos: number }
  >();
  for (const c of clients) {
    byClient.set(c.id, { ingresos: 0, egresosEquipo: 0, egresosGastos: 0 });
  }

  // Ingresos
  if (mode === "cashflow") {
    // Plata efectivamente cobrada (fecha_cobro presente).
    for (const i of invs) {
      if (!i.fecha_cobro) continue;
      const e = byClient.get(i.cliente_id);
      if (!e) continue;
      e.ingresos += toARS(Number(i.monto), i.moneda, rates);
    }
  } else {
    // Devengado / modelo: ingreso MENSUAL contratado según client_services activos.
    // Es el ingreso ideal que debería entrar cada mes si el cliente paga lo pactado.
    for (const s of svcs) {
      if (s.monto_mensual == null) continue;
      const e = byClient.get(s.cliente_id);
      if (!e) continue;
      e.ingresos += toARS(Number(s.monto_mensual), s.moneda, rates);
    }
  }

  let totalEgresosSinImputar = 0;

  if (mode === "cashflow") {
    // Cashflow: solo lo efectivamente pagado (fecha_pago), imputado a cliente.
    for (const x of exps) {
      if (!x.fecha_pago) continue;
      const ars = toARS(Number(x.monto), x.moneda, rates);
      if (x.cliente_id && byClient.has(x.cliente_id)) byClient.get(x.cliente_id)!.egresosGastos += ars;
      else totalEgresosSinImputar += ars;
    }
    for (const p of pays) {
      if (!p.fecha_pago) continue;
      const ars = toARS(Number(p.monto), p.moneda, rates);
      if (p.cliente_id && byClient.has(p.cliente_id)) byClient.get(p.cliente_id)!.egresosEquipo += ars;
      else totalEgresosSinImputar += ars;
    }
  } else {
    // Devengado / modelo: costo REAL que le corresponde a cada cliente por mes
    // según las tarifas de Coordinación (CM por pack + diseño + edición + media
    // buyer + entrega de otros servicios + comisión de coordinación). Es el costo
    // RECURRENTE (2° mes en adelante); el arranque del 1er mes se cotiza aparte.
    const rt = settings.rates;
    const packQty = new Map(settings.packs.map((p) => [p.id, p]));
    const svcByClient = new Map<string, ServiceRow[]>();
    for (const s of svcs) {
      if ((s.facturacion ?? "mensual") === "unico") continue;
      if (!svcByClient.has(s.cliente_id)) svcByClient.set(s.cliente_id, []);
      svcByClient.get(s.cliente_id)!.push(s);
    }
    for (const c of clients) {
      const cs = svcByClient.get(c.id) ?? [];
      const gestion = cs.find((s) => s.tipo === "gestion_redes");
      let costo = 0;
      if (gestion) {
        const pack = asPack(gestion.pack);
        if (gestion.costo_override != null) {
          costo += Number(gestion.costo_override) + mbCost(pack, rt);
        } else {
          const std = packQty.get(pack as never) as { posts: number; reels: number } | undefined;
          const pd = gestion.pack_detalle ?? {};
          const posts = std ? std.posts : Number(pd.posts ?? 0);
          const reels = std ? std.reels : Number(pd.reels ?? 0);
          costo += productionBase(pack, posts, reels, rt) + mbCost(pack, rt);
        }
      }
      for (const sv of cs) {
        if (sv.tipo === "diseno_grafico") {
          costo += standaloneDesignCost(sv, rt);
          continue;
        }
        const dc = serviceDeliveryCost(sv);
        if (dc) costo += dc.monto;
      }
      // Comisión de coordinación (la coordinadora cobra su % del abono de las
      // cuentas que coordina).
      const ingresoARS = byClient.get(c.id)?.ingresos ?? 0;
      if (gestion) costo += Math.round(ingresoARS * (rt.comision_coordinacion ?? 0));
      const e = byClient.get(c.id);
      if (e) e.egresosEquipo = costo;
    }
  }

  const rows = clients
    .map((c) => {
      const data = byClient.get(c.id)!;
      const egresos = data.egresosEquipo + data.egresosGastos;
      const margen = data.ingresos - egresos;
      const margenPct = data.ingresos > 0 ? (margen / data.ingresos) * 100 : null;
      return {
        cliente: c,
        ...data,
        egresos,
        margen,
        margenPct,
      };
    })
    .filter((r) => r.ingresos > 0 || r.egresos > 0)
    .sort((a, b) => b.margen - a.margen);

  const totales = rows.reduce(
    (acc, r) => ({
      ingresos: acc.ingresos + r.ingresos,
      egresos: acc.egresos + r.egresos,
      margen: acc.margen + r.margen,
    }),
    { ingresos: 0, egresos: 0, margen: 0 }
  );

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Rentabilidad por cliente</h1>
        <p className="max-w-3xl text-muted-foreground">
          Cuánto te deja cada cuenta activa por mes. Tenés dos miradas:{" "}
          <b>Cashflow real</b> = plata que entró/salió de verdad (si está vacío es
          porque todavía no cargaste cobros/pagos). <b>Devengado / modelo</b> = el
          abono contratado menos el <b>costo real del equipo</b> según tus tarifas
          de Coordinación (CM, diseño, edición, media buyer y coordinación). Es la
          rentabilidad <b>recurrente</b> (de 2° mes en adelante); el arranque del
          1er mes tiene costos extra que se cotizan aparte.
        </p>
      </div>

      {/* Toggle modo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border bg-card p-0.5">
          <Link
            href="/finanzas/rentabilidad?mode=cashflow"
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "cashflow"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cashflow real
          </Link>
          <Link
            href="/finanzas/rentabilidad?mode=devengado"
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "devengado"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Devengado / modelo
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "cashflow"
            ? "Solo lo cobrado y pagado efectivamente (histórico real)."
            : "Abono contratado − costo del equipo según tus tarifas de Coordinación. Muestra el margen recurrente de cada cuenta aunque todavía no hayas cargado cobros/pagos."}
        </p>
      </div>

      {/* Totales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total ingresos" value={totales.ingresos} icon={TrendingUp} color="emerald" />
        <Kpi label="Total egresos imputados" value={totales.egresos} icon={TrendingDown} color="amber" />
        <Kpi
          label="Margen neto"
          value={totales.margen}
          icon={Wallet}
          color={totales.margen >= 0 ? "primary" : "red"}
          subtitle={
            totales.ingresos > 0
              ? `${((totales.margen / totales.ingresos) * 100).toFixed(1)}% sobre ingreso`
              : undefined
          }
        />
      </div>

      {totalEgresosSinImputar > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-2 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
            <div className="text-xs">
              <div className="font-semibold">
                {fmtARS(totalEgresosSinImputar)} sin imputar a ningún cliente
              </div>
              <p className="text-amber-900/80 dark:text-amber-300/80">
                Son gastos y pagos al equipo que no marcaste como imputables a un
                cliente puntual (costos generales). No se descuentan del margen
                de ningún cliente individual. Para una vista más precisa, editá
                cada gasto/pago y elegí el cliente correspondiente cuando aplique.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Todavía no hay movimientos. Cargá facturas para que aparezcan acá.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2 text-right">Ingresos</th>
                    <th className="px-3 py-2 text-right">Equipo</th>
                    <th className="px-3 py-2 text-right">Gastos</th>
                    <th className="px-3 py-2 text-right">Margen</th>
                    <th className="px-3 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.cliente.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30",
                        r.margen < 0 && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/clientes/${r.cliente.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.cliente.nombre}
                        </Link>
                        {r.cliente.estado !== "activo" && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {fmtARS(r.ingresos)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.egresosEquipo > 0 ? fmtARS(r.egresosEquipo) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.egresosGastos > 0 ? fmtARS(r.egresosGastos) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          r.margen < 0 && "text-red-700 dark:text-red-400"
                        )}
                      >
                        {fmtARS(r.margen)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {r.margenPct !== null ? `${r.margenPct.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtARS(totales.ingresos)}
                    </td>
                    <td className="px-3 py-2" colSpan={2}>
                      <span className="text-right tabular-nums text-muted-foreground">
                        ({fmtARS(totales.egresos)})
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        totales.margen < 0 && "text-red-700"
                      )}
                    >
                      {fmtARS(totales.margen)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {totales.ingresos > 0
                        ? `${((totales.margen / totales.ingresos) * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 <b>Cómo funciona:</b> los gastos y pagos al equipo tienen un campo
        opcional &quot;Imputar a cliente&quot;. Cuando lo asignás (ej: una campaña
        de Meta Ads del cliente X, o el bonus por un proyecto puntual de Y), se
        descuentan del margen de ese cliente. Lo que dejás sin imputar queda como
        costo general arriba.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  color: "emerald" | "amber" | "primary" | "red";
  subtitle?: string;
}) {
  const accent: Record<typeof color, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    primary: "bg-primary/15 text-foreground",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accent[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold tabular-nums">{fmtARS(value)}</div>
          {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
