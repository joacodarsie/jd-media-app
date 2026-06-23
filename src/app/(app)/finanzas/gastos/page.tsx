import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { ExpensesTable, type ExpenseTableRow } from "@/components/expenses-table";
import { expenseCategoryLabel } from "@/lib/finanzas/expense-categories";

export const dynamic = "force-dynamic";

type Filter = "todos" | "pendientes" | "pagados";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

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
