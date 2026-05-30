import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { PaymentsTable, type PaymentTableRow } from "@/components/payments-table";
import { MonthPicker } from "@/components/month-picker";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todos" | "pendientes" | "atrasados" | "pagados";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todos", "pendientes", "atrasados", "pagados"].includes(filterParam)
    ? filterParam
    : "pendientes";
  const monthFilter =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : null;

  const [{ data: paymentsData }, { data: compsData }, { data: bankData }, usersWithPos, clients] =
    await Promise.all([
      supabase
        .from("team_payments")
        .select(
          "id, user_id, cliente_id, monto, moneda, periodo, concepto, fecha_programada, fecha_pago, metodo_pago, notas, usuario:users!team_payments_user_id_fkey(id,nombre)"
        )
        .order("fecha_programada", { ascending: true }),
      supabase
        .from("compensation")
        .select("user_id, monto"),
      // Datos para transferir (esta página ya está gateada por feature finanzas).
      supabase
        .from("users")
        .select("id, alias_cbu, cbu, titular_cuenta")
        .eq("activo", true),
      getActiveUsers(),
      getActiveClients(),
    ]);

  const all = (paymentsData ?? []) as unknown as PaymentTableRow[];
  const users = usersWithPos.map((u) => ({ id: u.id, nombre: u.nombre }));
  const comps = (compsData ?? []) as { user_id: string; monto: number | null }[];
  type BankRow = {
    id: string;
    alias_cbu: string | null;
    cbu: string | null;
    titular_cuenta: string | null;
  };
  const bankByUser = new Map(
    ((bankData ?? []) as BankRow[]).map((b) => [b.id, b])
  );
  const today = new Date().toISOString().slice(0, 10);

  // Cuántos no tienen compensación cargada (monto != null)
  const compByUser = new Map(comps.filter((c) => c.monto != null).map((c) => [c.user_id, c]));
  const sinComp = usersWithPos.filter((u) => !compByUser.has(u.id));
  const totalActivos = usersWithPos.length;

  let rows = all.filter((p) => {
    if (filter === "pendientes") return !p.fecha_pago;
    if (filter === "pagados") return !!p.fecha_pago;
    if (filter === "atrasados") return !p.fecha_pago && p.fecha_programada < today;
    return true;
  });
  if (monthFilter) rows = rows.filter((p) => p.periodo === monthFilter);

  const counts = {
    todos: all.length,
    pendientes: all.filter((p) => !p.fecha_pago).length,
    atrasados: all.filter((p) => !p.fecha_pago && p.fecha_programada < today).length,
    pagados: all.filter((p) => !!p.fecha_pago).length,
  };

  // Pendiente por persona
  const byUser = new Map<
    string,
    { nombre: string; pendientes: number; totalARS: number; proxima: string | null }
  >();
  for (const p of all.filter((x) => !x.fecha_pago)) {
    if (!p.usuario) continue;
    const k = p.usuario.id;
    if (!byUser.has(k))
      byUser.set(k, { nombre: p.usuario.nombre, pendientes: 0, totalARS: 0, proxima: null });
    const e = byUser.get(k)!;
    e.pendientes += 1;
    e.totalARS += toARS(Number(p.monto), p.moneda, rates);
    if (p.fecha_programada && (!e.proxima || p.fecha_programada < e.proxima)) {
      e.proxima = p.fecha_programada;
    }
  }
  const porPersona = Array.from(byUser.entries()).sort((a, b) => b[1].totalARS - a[1].totalARS);

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Pagos al equipo</h1>
        <p className="text-muted-foreground">
          Lo que tenés que pagar a cada miembro y cuándo. Cargá cada pago con
          el botón <b>Nuevo pago</b> en la tabla.
        </p>
      </div>

      {sinComp.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="space-y-2 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              ⚠️ Compensaciones sin cargar
            </div>
            <p className="text-xs">
              <b>{sinComp.length}</b> de {totalActivos} personas no tienen
              compensación mensual cargada. Sin eso no podés usar el botón
              &quot;Generar pagos del mes&quot; abajo (igual podés cargar cada pago a
              mano con <b>Nuevo pago</b>).
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Ver quiénes faltan
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {sinComp.map((u) => (
                  <li key={u.id} className="text-muted-foreground">
                    • {u.nombre} —{" "}
                    <Link href={`/equipo/persona/${u.id}`} className="underline">
                      cargar
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      {porPersona.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pendiente por persona
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Cuánto transferirle a cada uno, cuándo vence y a qué alias/CBU.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {porPersona.map(([id, p]) => {
                const bank = bankByUser.get(id);
                const dias =
                  p.proxima != null
                    ? Math.floor((Date.parse(p.proxima) - Date.parse(today)) / 86400000)
                    : null;
                const venc =
                  dias == null
                    ? null
                    : dias < 0
                    ? { txt: `Atrasado ${-dias}d`, cls: "text-red-600 dark:text-red-400" }
                    : dias === 0
                    ? { txt: "Vence hoy", cls: "text-amber-600 dark:text-amber-400" }
                    : { txt: `Vence en ${dias}d`, cls: "text-muted-foreground" };
                return (
                  <div
                    key={id}
                    className="space-y-1.5 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{p.nombre}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.pendientes} pago{p.pendientes !== 1 ? "s" : ""} pendiente
                          {p.pendientes !== 1 ? "s" : ""}
                          {venc && (
                            <span className={cn("ml-1 font-medium", venc.cls)}>
                              · {venc.txt}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums">
                        {fmtARS(p.totalARS)}
                      </div>
                    </div>
                    {bank && (bank.alias_cbu || bank.cbu) ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-1.5 text-[11px] text-muted-foreground">
                        {bank.alias_cbu && (
                          <span className="inline-flex items-center gap-1">
                            Alias{" "}
                            <span className="font-mono text-foreground">{bank.alias_cbu}</span>
                            <CopyButton value={bank.alias_cbu} />
                          </span>
                        )}
                        {bank.cbu && (
                          <span className="inline-flex items-center gap-1">
                            CBU{" "}
                            <span className="font-mono text-foreground">{bank.cbu}</span>
                            <CopyButton value={bank.cbu} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="border-t pt-1.5 text-[11px] text-muted-foreground">
                        Sin alias/CBU cargado.{" "}
                        <Link href={`/equipo/persona/${id}`} className="underline">
                          Cargar
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["pendientes", "atrasados", "pagados", "todos"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/pagos?f=${k}${monthFilter ? `&m=${monthFilter}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
              k === "atrasados" && filter !== k && counts.atrasados > 0 && "border-red-300 text-red-700"
            )}
          >
            {labelFor(k)} ({counts[k]})
          </Link>
        ))}
        <MonthPicker value={monthFilter} />
      </div>

      <PaymentsTable rows={rows} rates={rates} users={users} clients={clients} />

      {sinComp.length < totalActivos && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Atajo: generar pagos del mes en bloque
            </div>
            <p className="text-xs text-muted-foreground">
              Si querés crear de una vez todos los pagos recurrentes de un mes (a
              partir de las compensaciones cargadas), usá esto. No duplica si ya
              existían.
            </p>
            <GenerateMonthButton kind="payments" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function labelFor(k: "pendientes" | "atrasados" | "pagados" | "todos") {
  const m: Record<string, string> = {
    pendientes: "Pendientes",
    atrasados: "Atrasados",
    pagados: "Pagados",
    todos: "Todos",
  };
  return m[k];
}
