import Link from "next/link";
import { Briefcase, TrendingUp, Wallet, Users, Repeat } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface WonClient {
  id: string;
  nombre: string;
  estado: string;
  mrr: number; // recurrente activo, ARS
  cobrado: number; // total cobrado histórico, ARS
}

interface ComercialRow {
  id: string;
  nombre: string;
  clientes: WonClient[];
  activos: number;
  mrrActivo: number; // recurrente que trae hoy
  totalCobrado: number; // facturado histórico a sus clientes
  totalPagado: number; // lo que se le pagó (real)
  mesesPagados: number;
  costoMensual: number; // promedio mensual pagado
}

export default async function ComercialPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const rates = await getExchangeRates();

  const [{ data: usersRaw }, { data: leadsRaw }] = await Promise.all([
    admin.from("users").select("id, nombre, rol").eq("rol", "comercial"),
    admin
      .from("leads")
      .select("asignado_a_id, ganado_cliente_id")
      .not("ganado_cliente_id", "is", null),
  ]);

  const comerciales = (usersRaw ?? []) as { id: string; nombre: string }[];
  const leads = (leadsRaw ?? []) as {
    asignado_a_id: string | null;
    ganado_cliente_id: string | null;
  }[];

  // cliente → comercial que lo cerró (primer lead ganado asignado a un comercial)
  const comercialIds = new Set(comerciales.map((c) => c.id));
  const clientToComercial = new Map<string, string>();
  for (const l of leads) {
    if (!l.ganado_cliente_id || !l.asignado_a_id) continue;
    if (!comercialIds.has(l.asignado_a_id)) continue;
    if (!clientToComercial.has(l.ganado_cliente_id)) {
      clientToComercial.set(l.ganado_cliente_id, l.asignado_a_id);
    }
  }
  const wonClientIds = [...clientToComercial.keys()];

  // Datos de esos clientes + servicios + cobros, y pagos a los comerciales.
  const [{ data: clientsRaw }, { data: svcRaw }, { data: invRaw }, { data: payRaw }] =
    await Promise.all([
      wonClientIds.length
        ? admin.from("clients").select("id, nombre, estado").in("id", wonClientIds)
        : Promise.resolve({ data: [] }),
      wonClientIds.length
        ? admin
            .from("client_services")
            .select("cliente_id, monto_mensual, moneda, activo, facturacion")
            .in("cliente_id", wonClientIds)
        : Promise.resolve({ data: [] }),
      wonClientIds.length
        ? admin
            .from("client_invoices")
            .select("cliente_id, monto, moneda, fecha_cobro")
            .in("cliente_id", wonClientIds)
            .not("fecha_cobro", "is", null)
        : Promise.resolve({ data: [] }),
      comerciales.length
        ? admin
            .from("team_payments")
            .select("user_id, monto, moneda, fecha_pago")
            .in(
              "user_id",
              comerciales.map((c) => c.id)
            )
            .not("fecha_pago", "is", null)
        : Promise.resolve({ data: [] }),
    ]);

  const clients = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    estado: string;
  }[];
  const svcs = (svcRaw ?? []) as {
    cliente_id: string;
    monto_mensual: number | null;
    moneda: string;
    activo: boolean;
    facturacion: string | null;
  }[];
  const invs = (invRaw ?? []) as {
    cliente_id: string;
    monto: number;
    moneda: string;
  }[];
  const pays = (payRaw ?? []) as {
    user_id: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
  }[];

  // MRR activo y total cobrado por cliente
  const mrrByClient = new Map<string, number>();
  for (const s of svcs) {
    if (!s.activo || s.monto_mensual == null) continue;
    if ((s.facturacion ?? "mensual") !== "mensual") continue;
    mrrByClient.set(
      s.cliente_id,
      (mrrByClient.get(s.cliente_id) ?? 0) + toARS(Number(s.monto_mensual), s.moneda, rates)
    );
  }
  const cobradoByClient = new Map<string, number>();
  for (const i of invs) {
    cobradoByClient.set(
      i.cliente_id,
      (cobradoByClient.get(i.cliente_id) ?? 0) + toARS(Number(i.monto), i.moneda, rates)
    );
  }

  // Pagos por comercial
  const pagadoByUser = new Map<string, number>();
  const mesesByUser = new Map<string, Set<string>>();
  for (const p of pays) {
    pagadoByUser.set(
      p.user_id,
      (pagadoByUser.get(p.user_id) ?? 0) + toARS(Number(p.monto), p.moneda, rates)
    );
    if (!mesesByUser.has(p.user_id)) mesesByUser.set(p.user_id, new Set());
    mesesByUser.get(p.user_id)!.add(p.fecha_pago.slice(0, 7));
  }

  const clientById = new Map(clients.map((c) => [c.id, c]));

  const rows: ComercialRow[] = comerciales
    .map((com) => {
      const sus = wonClientIds.filter((cid) => clientToComercial.get(cid) === com.id);
      const clientes: WonClient[] = sus
        .map((cid) => {
          const c = clientById.get(cid);
          return {
            id: cid,
            nombre: c?.nombre ?? "—",
            estado: c?.estado ?? "—",
            mrr: mrrByClient.get(cid) ?? 0,
            cobrado: cobradoByClient.get(cid) ?? 0,
          };
        })
        .sort((a, b) => b.mrr - a.mrr || b.cobrado - a.cobrado);
      const activos = clientes.filter((c) => c.estado === "activo").length;
      const mrrActivo = clientes.reduce((a, c) => a + c.mrr, 0);
      const totalCobrado = clientes.reduce((a, c) => a + c.cobrado, 0);
      const totalPagado = pagadoByUser.get(com.id) ?? 0;
      const mesesPagados = mesesByUser.get(com.id)?.size ?? 0;
      const costoMensual = mesesPagados > 0 ? totalPagado / mesesPagados : 0;
      return {
        id: com.id,
        nombre: com.nombre,
        clientes,
        activos,
        mrrActivo,
        totalCobrado,
        totalPagado,
        mesesPagados,
        costoMensual,
      };
    })
    .sort((a, b) => b.mrrActivo - a.mrrActivo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Briefcase className="h-6 w-6 text-primary" /> Rendimiento comercial
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Si el rol comercial <b>se paga solo</b>. Cruza los clientes que cerró cada uno
          (vía los leads que ganó) contra lo que se le pagó. Dos lecturas: el{" "}
          <b>recurrente mensual</b> que trae hoy y el <b>acumulado histórico</b>.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No hay usuarios con rol comercial.
          </CardContent>
        </Card>
      ) : (
        rows.map((r) => {
          const margenRec = r.mrrActivo - r.costoMensual;
          const roi = r.totalPagado > 0 ? r.totalCobrado / r.totalPagado : null;
          return (
            <div key={r.id} className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" /> {r.nombre}
              </h2>

              {/* Lectura recurrente */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  label="Clientes que cerró"
                  plain={`${r.clientes.length} · ${r.activos} activos`}
                  icon={Users}
                  color="primary"
                />
                <Kpi
                  label="MRR que trae hoy"
                  value={r.mrrActivo}
                  icon={Repeat}
                  color="emerald"
                  subtitle="recurrente de sus cuentas activas"
                />
                <Kpi
                  label="Su costo mensual"
                  value={r.costoMensual}
                  icon={Wallet}
                  color="amber"
                  subtitle={
                    r.mesesPagados > 0
                      ? `prom. de ${r.mesesPagados} mes(es) pagados`
                      : "sin pagos cargados"
                  }
                />
                <Kpi
                  label="Margen recurrente / mes"
                  value={margenRec}
                  icon={TrendingUp}
                  color={margenRec >= 0 ? "primary" : "red"}
                  subtitle={margenRec >= 0 ? "se paga solo" : "no se cubre"}
                />
              </div>

              {/* Lectura acumulada */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Kpi
                  label="Total facturado a sus clientes"
                  value={r.totalCobrado}
                  icon={TrendingUp}
                  color="emerald"
                  subtitle="cobrado histórico"
                />
                <Kpi
                  label="Total que se le pagó"
                  value={r.totalPagado}
                  icon={Wallet}
                  color="amber"
                  subtitle="sueldo + comisiones reales"
                />
                <Kpi
                  label="Retorno acumulado"
                  plain={roi != null ? `${roi.toFixed(1)}×` : "—"}
                  icon={TrendingUp}
                  color={roi != null && roi >= 1 ? "primary" : "red"}
                  subtitle="facturado ÷ pagado"
                />
              </div>

              {/* Tabla de clientes cerrados */}
              <Card>
                <CardContent className="p-0">
                  {r.clientes.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      Todavía no tiene clientes cerrados cargados (leads ganados).
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2 text-right">MRR actual</th>
                            <th className="px-3 py-2 text-right">Facturado total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.clientes.map((c) => (
                            <tr
                              key={c.id}
                              className={cn(
                                "border-b last:border-0 hover:bg-muted/30",
                                c.estado !== "activo" && "opacity-60"
                              )}
                            >
                              <td className="px-3 py-2">
                                <Link
                                  href={`/clientes/${c.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {c.nombre}
                                </Link>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    c.estado === "activo"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {c.estado === "activo" ? "Activo" : "Se fue"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                                {c.mrr > 0 ? fmtARS(c.mrr) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                {c.cobrado > 0 ? fmtARS(c.cobrado) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })
      )}

      <p className="text-xs text-muted-foreground">
        💡 La atribución sale de los <b>leads ganados</b> asignados a cada comercial
        (cada cliente se cuenta una vez, para quien lo cerró primero). El costo son los{" "}
        <b>pagos reales</b> registrados (sueldo + comisiones). &quot;Facturado total&quot;
        es lo cobrado a esos clientes en toda la relación, así que crece con el tiempo
        aunque el cliente ya no esté.
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
