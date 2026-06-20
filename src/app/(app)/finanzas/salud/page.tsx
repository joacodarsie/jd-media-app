import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import {
  toARS,
  fmtARS,
  currentPeriod,
  nextPeriod,
  prevPeriod,
  periodLabel,
} from "@/lib/finanzas";
import {
  mergeSettings,
  productionBase,
  mbCost,
  serviceDeliveryCost,
  type AgencySettings,
  type RatePack,
} from "@/lib/coordinacion";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RATE_PACKS: string[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];
function asPack(p: string | null): RatePack {
  return p && RATE_PACKS.includes(p) ? (p as RatePack) : "Personalizado";
}

export default async function SaludAgenciaPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  await requireFeature("finanzas");
  const admin = createAdmin();
  const rates = await getExchangeRates();
  const period = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "")
    ? (searchParams.mes as string)
    : currentPeriod();
  const start = `${period}-01`;
  const end = `${nextPeriod(period)}-01`; // exclusivo (evita fechas inválidas tipo -31)

  const [
    { data: settingsRow },
    { data: clientsRaw },
    { data: svcRaw },
    { data: pubsRaw },
    { data: usersRaw },
  ] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin
      .from("clients")
      .select("id, nombre, estado, pack")
      .eq("es_interno", false)
      .eq("estado", "activo")
      .order("nombre"),
    admin
      .from("client_services")
      .select(
        "cliente_id, tipo, monto_mensual, moneda, activo, facturacion, costo_override, costo_pct, costo_override_user, created_at"
      )
      .eq("activo", true),
    admin
      .from("publications")
      .select("cliente_id, tipo, estado, fecha_publicacion")
      .eq("estado", "publicado")
      .gte("fecha_publicacion", start)
      .lt("fecha_publicacion", end),
    admin.from("users").select("id, nombre"),
  ]);

  const settings: AgencySettings = mergeSettings(
    settingsRow as Partial<AgencySettings> | null
  );
  const rt = settings.rates;
  const clients = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    estado: string;
    pack: string | null;
  }[];
  const svcs = (svcRaw ?? []) as {
    cliente_id: string;
    tipo: string;
    monto_mensual: number | null;
    moneda: string;
    facturacion: string | null;
    costo_override: number | null;
    costo_pct: number | null;
    costo_override_user: string | null;
    created_at: string | null;
  }[];
  const pubs = (pubsRaw ?? []) as { cliente_id: string; tipo: string }[];
  const userName = new Map(
    ((usersRaw ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
  );

  // MRR = solo servicios RECURRENTES (mensual). Los cobros únicos (proyectos
  // puntuales) NO son MRR; se muestran aparte. Además: qué cuentas tienen
  // gestión de redes (la pauta/media buyer va incluida ahí) y el costo de
  // entrega de los servicios recurrentes que no son por-pieza.
  const mrrByC = new Map<string, number>();
  const gestionByC = new Set<string>();
  const otroCostoByC = new Map<string, number>(); // costo de servicios recurrentes no-gestión
  for (const s of svcs) {
    const esUnico = (s.facturacion ?? "mensual") === "unico";
    if (s.monto_mensual != null && !esUnico) {
      mrrByC.set(
        s.cliente_id,
        (mrrByC.get(s.cliente_id) ?? 0) + toARS(Number(s.monto_mensual), s.moneda, rates)
      );
    }
    if (s.tipo === "gestion_redes") gestionByC.add(s.cliente_id);
    // Costo de entrega de servicios recurrentes que no son gestión ni pauta.
    if (!esUnico) {
      const dc = serviceDeliveryCost(s);
      if (dc) {
        otroCostoByC.set(
          s.cliente_id,
          (otroCostoByC.get(s.cliente_id) ?? 0) + toARS(dc.monto, s.moneda, rates)
        );
      }
    }
  }

  // Proyectos puntuales (cobro único) imputados al mes en que se cargaron.
  const proyectos = svcs
    .filter(
      (s) => (s.facturacion ?? "mensual") === "unico" && (s.created_at ?? "").slice(0, 7) === period
    )
    .map((s) => {
      const ingreso = s.monto_mensual != null ? toARS(Number(s.monto_mensual), s.moneda, rates) : 0;
      const dc = serviceDeliveryCost(s);
      const costo = dc ? toARS(dc.monto, s.moneda, rates) : 0;
      const cliente = clients.find((c) => c.id === s.cliente_id)?.nombre ?? "—";
      return {
        cliente,
        tipo: s.tipo,
        quien: dc?.userId ? userName.get(dc.userId) ?? null : null,
        ingreso,
        costo,
        margen: ingreso - costo,
      };
    })
    .sort((a, b) => b.ingreso - a.ingreso);

  // Piezas publicadas en el mes, por cliente.
  const reelsByC = new Map<string, number>();
  const postsByC = new Map<string, number>();
  for (const p of pubs) {
    if (p.tipo === "reel" || p.tipo === "video")
      reelsByC.set(p.cliente_id, (reelsByC.get(p.cliente_id) ?? 0) + 1);
    else if (p.tipo === "post" || p.tipo === "carrusel")
      postsByC.set(p.cliente_id, (postsByC.get(p.cliente_id) ?? 0) + 1);
  }

  const rows = clients
    .map((c) => {
      const pack = asPack(c.pack);
      const reels = reelsByC.get(c.id) ?? 0;
      const posts = postsByC.get(c.id) ?? 0;
      const mrr = mrrByC.get(c.id) ?? 0;
      const tieneGestion = gestionByC.has(c.id);
      // Costo recurrente real:
      //  - si tiene gestión de redes: CM (fijo del pack, incluye historias) +
      //    posts×diseño + reels×edición + media buyer (va incluido en gestión).
      //  - costo de entrega de otros servicios recurrentes (web/botly/diseño %).
      // Las cuentas SIN gestión (ej. solo proyectos puntuales) no llevan el
      // costo del modelo por-pieza.
      const costoGestion = tieneGestion
        ? productionBase(pack, posts, reels, rt) + mbCost(pack, rt)
        : 0;
      const costo = costoGestion + (otroCostoByC.get(c.id) ?? 0);
      const margen = mrr - costo;
      const margenPct = mrr > 0 ? (margen / mrr) * 100 : null;
      return { c, pack, reels, posts, mrr, hasPaid: tieneGestion, costo, margen, margenPct };
    })
    .filter((x) => x.mrr > 0 || x.costo > 0)
    .sort((a, b) => b.margen - a.margen);

  const tot = rows.reduce(
    (acc, r) => ({
      mrr: acc.mrr + r.mrr,
      costo: acc.costo + r.costo,
      margen: acc.margen + r.margen,
    }),
    { mrr: 0, costo: 0, margen: 0 }
  );
  const totPct = tot.mrr > 0 ? (tot.margen / tot.mrr) * 100 : 0;
  const enRojo = rows.filter((r) => r.margen < 0).length;
  const enRiesgo = rows.filter((r) => r.margen >= 0 && r.margenPct != null && r.margenPct < 30).length;
  const arpa = rows.length > 0 ? tot.mrr / rows.length : 0; // ingreso promedio por cuenta
  const proyAnual = tot.mrr * 12; // proyección de ingreso anual al ritmo actual

  const esMesActual = period === currentPeriod();

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
          <h1 className="text-2xl font-bold">Salud de la agencia</h1>
          <p className="max-w-2xl text-muted-foreground">
            Margen <b>real</b> por cliente: ingreso mensual contratado menos el{" "}
            <b>costo de producción</b> calculado con las piezas publicadas del mes ×
            tu tarifa interna (CM por pack + diseño/edición + media buyer si hay pauta).
          </p>
        </div>
        {/* Selector de mes */}
        <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
          <Link
            href={`/finanzas/salud?mes=${prevPeriod(period)}`}
            className="rounded-sm p-1.5 hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-medium capitalize">{periodLabel(period)}</span>
          <Link
            href={`/finanzas/salud?mes=${nextPeriod(period)}`}
            className="rounded-sm p-1.5 hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {esMesActual && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Estás viendo el <b>mes en curso</b>: el costo del CM ya está completo pero
            las piezas se van publicando, así que el margen se ajusta a medida que avanza
            el mes. Para una foto cerrada, mirá un mes anterior.
          </span>
        </div>
      )}

      {/* KPIs — vista de agencia */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Ingreso mensual (MRR)"
          value={tot.mrr}
          icon={TrendingUp}
          color="emerald"
          subtitle={`${rows.length} cuentas activas`}
        />
        <Kpi
          label="Ingreso promedio / cuenta"
          value={arpa}
          icon={Wallet}
          color="primary"
          subtitle="ARPA"
        />
        <Kpi
          label="Proyección anual"
          value={proyAnual}
          icon={TrendingUp}
          color="emerald"
          subtitle="al ritmo de MRR actual"
        />
        <Kpi label="Costo de producción" value={tot.costo} icon={TrendingDown} color="amber" />
        <Kpi
          label="Margen real"
          value={tot.margen}
          icon={Wallet}
          color={tot.margen >= 0 ? "primary" : "red"}
          subtitle={tot.mrr > 0 ? `${totPct.toFixed(1)}% sobre ingreso` : undefined}
        />
        <Kpi
          label="Cuentas a revisar"
          plain={`${enRojo} en rojo · ${enRiesgo} bajo 30%`}
          icon={AlertTriangle}
          color={enRojo > 0 ? "red" : "primary"}
        />
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay clientes activos con servicios para este mes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Pack</th>
                    <th className="px-3 py-2 text-right">Piezas</th>
                    <th className="px-3 py-2 text-right">Ingreso</th>
                    <th className="px-3 py-2 text-right">Costo prod.</th>
                    <th className="px-3 py-2 text-right">Margen</th>
                    <th className="px-3 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.c.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30",
                        r.margen < 0 && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-3 py-2">
                        <Link href={`/clientes/${r.c.id}`} className="font-medium hover:underline">
                          {r.c.nombre}
                        </Link>
                        {r.hasPaid && (
                          <span className="ml-2 text-[10px] text-muted-foreground">+ pauta</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.pack}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {r.reels}r · {r.posts}p
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {fmtARS(r.mrr)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtARS(r.costo)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          r.margen < 0 && "text-red-700 dark:text-red-400"
                        )}
                      >
                        {fmtARS(r.margen)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right text-xs tabular-nums",
                          r.margenPct != null && r.margenPct < 0
                            ? "text-red-700 dark:text-red-400"
                            : r.margenPct != null && r.margenPct < 30
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {r.margenPct != null ? `${r.margenPct.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      Total ({rows.length} cuentas)
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtARS(tot.mrr)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmtARS(tot.costo)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        tot.margen < 0 && "text-red-700"
                      )}
                    >
                      {fmtARS(tot.margen)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {tot.mrr > 0 ? `${totPct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Proyectos puntuales (cobros únicos del mes) ── */}
      {proyectos.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <h2 className="text-base font-semibold">Proyectos puntuales</h2>
              <p className="text-xs text-muted-foreground">
                Cobros únicos imputados a {periodLabel(period)} (no son MRR). El costo
                es lo que le pagás a quien lo entrega (% del monto o fijo).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Servicio</th>
                    <th className="px-3 py-2">Entrega</th>
                    <th className="px-3 py-2 text-right">Cobro</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectos.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{p.cliente}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {SERVICE_TYPE_LABEL[p.tipo] ?? p.tipo}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.quien ?? (p.costo > 0 ? "—" : "sin costo cargado")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {fmtARS(p.ingreso)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtARS(p.costo)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {fmtARS(p.margen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        💡 El <b>costo de producción</b> sale de tus tarifas internas (editables en
        Coordinación): CM por pack (incluye historias), {fmtARS(rt.diseno_pieza)} por
        post/carrusel, {fmtARS(rt.edicion_reel)} por reel, y el media buyer si la cuenta
        tiene pauta. Los servicios que no son por-pieza (branding, web, botly…) usan el
        costo de entrega cargado en cada servicio (% del monto o fijo). No incluye costos
        generales (oficina, software) ni la comisión del closer (one-time).
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  plain,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value?: number;
  plain?: string;
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
          <div className="text-lg font-bold tabular-nums">
            {plain != null ? plain : fmtARS(value ?? 0)}
          </div>
          {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
