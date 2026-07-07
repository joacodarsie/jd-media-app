import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { ExpensesTable, type ExpenseTableRow } from "@/components/expenses-table";
import { expenseCategoryLabel } from "@/lib/finanzas/expense-categories";
import {
  SubscriptionsManager,
  type SubscriptionRow,
  monthlyARS,
} from "@/components/subscriptions-manager";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todos" | "pendientes" | "pagados";
type Vista = "gastos" | "subs";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string; v?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  // Vista: gastos puntuales (default) o suscripciones recurrentes.
  // Antes eran 2 páginas; son la misma pregunta ("¿qué paga la agencia?").
  const vista: Vista = searchParams.v === "subs" ? "subs" : "gastos";

  const toggle = (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          { key: "gastos", label: "Gastos", href: "/finanzas/gastos" },
          { key: "subs", label: "Suscripciones", href: "/finanzas/gastos?v=subs" },
        ] as const
      ).map((opt) => (
        <Link
          key={opt.key}
          href={opt.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            vista === opt.key
              ? "border-primary bg-primary/10 text-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );

  // ── Vista SUSCRIPCIONES ──
  if (vista === "subs") {
    const [{ data: subsRaw }, usersData] = await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "id, nombre, categoria, costo, moneda, ciclo, proxima_renovacion, metodo_pago, administrador_id, url, activa, notas"
        )
        .order("activa", { ascending: false })
        .order("nombre"),
      getActiveUsers(),
    ]);

    const subs = (subsRaw ?? []) as SubscriptionRow[];
    const users = usersData as { id: string; nombre: string }[];

    const activas = subs.filter((s) => s.activa);
    const totalMensualARS = activas.reduce(
      (a, s) => a + toARS(monthlyARS(s), s.moneda, rates),
      0
    );
    const totalAnualARS = totalMensualARS * 12;

    return (
      <div className="space-y-5">
        <Link
          href="/finanzas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>

        <div>
          <h1 className="text-2xl font-bold">Suscripciones y plataformas</h1>
          <p className="text-muted-foreground">
            Todo lo recurrente que paga la agencia (SaaS, herramientas). Registrá
            el pago cuando toque y entra al cashflow como gasto del mes.
          </p>
        </div>

        {toggle}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard label="Suscripciones activas" value={String(activas.length)} />
          <MiniCard label="Costo mensual (ARS)" value={fmtARS(totalMensualARS)} sub="normalizado al blue" />
          <MiniCard label="Proyección anual" value={fmtARS(totalAnualARS)} sub="× 12 meses" />
        </div>

        <SubscriptionsManager
          subs={subs}
          users={users}
          usdRate={rates.USD}
          eurRate={rates.EUR}
        />
      </div>
    );
  }

  // ── Vista GASTOS (default) ──
  const filter: Filter = ["todos", "pendientes", "pagados"].includes(searchParams.f ?? "")
    ? (searchParams.f as Filter)
    : "todos";

  const monthFilter = searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m)
    ? searchParams.m
    : null;

  const [{ data }, { data: clientsData }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, concepto, categoria, proveedor, monto, moneda, fecha_pago, fecha_programada, periodo, recurrente, recurrente_dia, cliente_id, notas, created_at"
      )
      .order("fecha_pago", { ascending: false, nullsFirst: false })
      .order("fecha_programada", { ascending: false, nullsFirst: false }),
    supabase
      .from("clients")
      .select("id, nombre")
      .order("nombre"),
  ]);

  const all = (data ?? []) as unknown as ExpenseTableRow[];
  const clients = (clientsData ?? []) as { id: string; nombre: string }[];

  let rows = all;
  if (filter === "pendientes") rows = rows.filter((e) => !e.fecha_pago);
  if (filter === "pagados") rows = rows.filter((e) => !!e.fecha_pago);
  if (monthFilter) rows = rows.filter((e) => e.periodo === monthFilter);

  // Resumen por categoría (del filtrado)
  const byCategory = new Map<string, number>();
  for (const e of rows) {
    const k = e.categoria;
    byCategory.set(k, (byCategory.get(k) ?? 0) + toARS(Number(e.monto), e.moneda, rates));
  }
  const categorias = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Gastos</h1>
        <p className="text-muted-foreground">
          Plataformas, ads de JD propios, contador, impuestos, oficina. Todo lo
          que no es pago al equipo ni venta a cliente.
        </p>
      </div>

      {toggle}

      {categorias.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {monthFilter ? `Por categoría — ${monthFilter}` : "Por categoría — total"}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {categorias.map(([cat, total]) => {
                const label = expenseCategoryLabel(cat);
                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <span className="truncate text-xs text-muted-foreground">
                      {label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {fmtARS(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ExpensesTable rows={rows} rates={rates} filter={filter} monthFilter={monthFilter} clients={clients} />
    </div>
  );
}

function MiniCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
