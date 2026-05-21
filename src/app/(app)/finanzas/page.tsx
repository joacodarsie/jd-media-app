import { Wallet, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_TYPE_LABEL, PAY_FREQUENCY_LABEL } from "@/lib/constants";
import { getExchangeRates, type ExchangeRates } from "@/lib/exchange";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface ServiceRow {
  id: string;
  tipo: string;
  pack: string | null;
  monto_mensual: number | null;
  moneda: string;
  activo: boolean;
  cliente: { id: string; nombre: string; estado: string } | null;
}

interface CompensationRow {
  monto: number | null;
  moneda: string | null;
  frecuencia: string | null;
  usuario: { id: string; nombre: string; position_id: string | null } | null;
}

interface PositionRow {
  id: string;
  nombre: string;
  pago_default_monto: number | null;
  pago_default_moneda: string | null;
  pago_default_frecuencia: string | null;
}

interface UserRow {
  id: string;
  nombre: string;
  position_id: string | null;
}

function toMonthlyARS(
  monto: number,
  moneda: string,
  frecuencia: string | null,
  rates: ExchangeRates
): number {
  const tasa = moneda === "USD" ? rates.USD : moneda === "EUR" ? rates.EUR : 1;
  const enARS = monto * tasa;
  switch (frecuencia) {
    case "semanal":
      return enARS * 4.33;
    case "quincenal":
      return enARS * 2.17;
    case "proyecto":
    case "por_tarea":
    case "comision":
      // No es recurrente. Lo dejamos en 0 mensual.
      return 0;
    case "mensual":
    default:
      return enARS;
  }
}

export default async function FinanzasPage() {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();

  const [{ data: services }, { data: comps }, { data: positions }, { data: users }] =
    await Promise.all([
      supabase
        .from("client_services")
        .select(
          "id,tipo,pack,monto_mensual,moneda,activo, cliente:clients(id,nombre,estado)"
        )
        .eq("activo", true),
      supabase
        .from("compensation")
        .select(
          "monto,moneda,frecuencia, usuario:users!compensation_user_id_fkey(id,nombre,position_id)"
        ),
      supabase.from("positions").select("*"),
      supabase.from("users").select("id,nombre,position_id").eq("activo", true),
    ]);

  const svcRows = (services ?? []) as unknown as ServiceRow[];
  const compRows = (comps ?? []) as unknown as CompensationRow[];
  const posRows = (positions ?? []) as PositionRow[];
  const userRows = (users ?? []) as UserRow[];

  const posMap = new Map(posRows.map((p) => [p.id, p]));
  const compByUser = new Map(
    compRows.filter((c) => c.usuario).map((c) => [c.usuario!.id, c])
  );

  // Ingresos: suma de servicios activos en clientes activos, convertido a ARS/mes
  const ingresoMensual = svcRows
    .filter((s) => s.cliente?.estado === "activo" && s.monto_mensual != null)
    .reduce(
      (acc, s) =>
        acc + toMonthlyARS(Number(s.monto_mensual), s.moneda, "mensual", rates),
      0
    );

  // Egresos: compensación efectiva por usuario (override si existe, sino default del puesto)
  let egresoMensual = 0;
  const personas = userRows.map((u) => {
    const ov = compByUser.get(u.id);
    const pos = u.position_id ? posMap.get(u.position_id) : null;
    const eff = ov
      ? {
          monto: ov.monto,
          moneda: ov.moneda ?? "ARS",
          frecuencia: ov.frecuencia ?? "mensual",
          source: "override" as const,
        }
      : {
          monto: pos?.pago_default_monto ?? null,
          moneda: pos?.pago_default_moneda ?? "ARS",
          frecuencia: pos?.pago_default_frecuencia ?? "mensual",
          source: "puesto" as const,
        };
    const enARS =
      eff.monto != null
        ? toMonthlyARS(Number(eff.monto), eff.moneda, eff.frecuencia, rates)
        : 0;
    egresoMensual += enARS;
    return { user: u, eff, mensualARS: enARS, posicion: pos };
  });

  const margen = ingresoMensual - egresoMensual;
  const margenPct = ingresoMensual > 0 ? (margen / ingresoMensual) * 100 : 0;

  // Servicios agrupados por cliente
  const byCliente = new Map<string, { nombre: string; total: number; servicios: ServiceRow[] }>();
  for (const s of svcRows) {
    if (!s.cliente || s.cliente.estado !== "activo") continue;
    const key = s.cliente.id;
    if (!byCliente.has(key)) {
      byCliente.set(key, { nombre: s.cliente.nombre, total: 0, servicios: [] });
    }
    const entry = byCliente.get(key)!;
    entry.servicios.push(s);
    if (s.monto_mensual != null) {
      entry.total += toMonthlyARS(Number(s.monto_mensual), s.moneda, "mensual", rates);
    }
  }
  const clientesOrdenados = Array.from(byCliente.entries()).sort(
    (a, b) => b[1].total - a[1].total
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">
            Vista privada para admin. Cálculo de ingresos vs egresos mensual, convertido a ARS.
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
            {rates.source === "live"
              ? `dolarapi.com · ${new Date(rates.fetchedAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Cordoba", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`
              : "API caída — usando valor de respaldo"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Ingreso mensual"
          value={ingresoMensual}
          icon={TrendingUp}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <KpiCard
          label="Egreso mensual"
          value={egresoMensual}
          icon={TrendingDown}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        />
        <KpiCard
          label="Margen mensual"
          value={margen}
          icon={Wallet}
          accent={
            margen >= 0
              ? "bg-primary/15 text-foreground"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          }
          subtitle={`${margenPct.toFixed(1)}% sobre ingreso`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingreso por cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {clientesOrdenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay servicios activos cargados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Cliente</th>
                  <th>Servicios</th>
                  <th className="text-right">Total /mes</th>
                </tr>
              </thead>
              <tbody>
                {clientesOrdenados.map(([id, c]) => (
                  <tr key={id} className="border-t">
                    <td className="py-2 font-medium">{c.nombre}</td>
                    <td className="text-xs text-muted-foreground">
                      {c.servicios
                        .map(
                          (s) =>
                            `${SERVICE_TYPE_LABEL[s.tipo]}${s.pack ? ` (${s.pack})` : ""}`
                        )
                        .join(" · ")}
                    </td>
                    <td className="text-right tabular-nums">
                      ARS {Math.round(c.total).toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Egresos por persona</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Persona</th>
                <th>Puesto</th>
                <th>Compensación</th>
                <th className="text-right">ARS /mes equivalente</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.user.id} className="border-t">
                  <td className="py-2 font-medium">{p.user.nombre}</td>
                  <td className="text-xs text-muted-foreground">
                    {p.posicion?.nombre ?? "—"}
                  </td>
                  <td className="text-xs">
                    {p.eff.monto == null ? (
                      <span className="text-muted-foreground">Sin cargar</span>
                    ) : (
                      <>
                        {p.eff.moneda}{" "}
                        {Number(p.eff.monto).toLocaleString("es-AR")}{" "}
                        <span className="text-muted-foreground">
                          ·{" "}
                          {PAY_FREQUENCY_LABEL[p.eff.frecuencia ?? "mensual"] ??
                            p.eff.frecuencia}
                        </span>
                        {p.eff.source === "puesto" && (
                          <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                            del puesto
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {p.mensualARS > 0
                      ? `ARS ${Math.round(p.mensualARS).toLocaleString("es-AR")}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 p-4 text-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
          <div>
            <div className="font-semibold text-amber-900 dark:text-amber-200">
              Sobre los cálculos
            </div>
            <p className="mt-1 text-amber-900/80 dark:text-amber-300/80">
              Las compensaciones por proyecto / comisión / por tarea no son recurrentes
              y figuran como ARS 0 mensual (no se proyectan automáticamente).
              Cotización usada: USD ${rates.USD.toLocaleString("es-AR")} ·
              EUR ${rates.EUR.toLocaleString("es-AR")}
              {" "}({rates.source === "live"
                ? `live · dolarapi.com`
                : `fallback (API no respondió)`}).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  accent: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold tabular-nums">
            ARS {Math.round(value).toLocaleString("es-AR")}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
