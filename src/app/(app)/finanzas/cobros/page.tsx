import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveClients } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import { isOverdue } from "@/lib/finanzas";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { InvoicesTable, type InvoiceTableRow } from "@/components/invoices-table";
import { MonthPicker } from "@/components/month-picker";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todas" | "pendientes" | "vencidas" | "cobradas";

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todas", "pendientes", "vencidas", "cobradas"].includes(filterParam)
    ? filterParam
    : "pendientes";
  const monthFilter =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : null;

  const [{ data: invoicesData }, clients] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, cliente_id, monto, moneda, periodo, concepto, fecha_emision, fecha_vencimiento, fecha_cobro, metodo_pago, notas, cliente:clients(id,nombre)"
      )
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getActiveClients(),
  ]);

  const all = (invoicesData ?? []) as unknown as InvoiceTableRow[];

  let rows = all.filter((i) => {
    if (filter === "pendientes") return !i.fecha_cobro;
    if (filter === "cobradas") return !!i.fecha_cobro;
    if (filter === "vencidas") return isOverdue(i.fecha_vencimiento, i.fecha_cobro);
    return true;
  });
  if (monthFilter) rows = rows.filter((i) => i.periodo === monthFilter);

  const counts = {
    todas: all.length,
    pendientes: all.filter((i) => !i.fecha_cobro).length,
    vencidas: all.filter((i) => isOverdue(i.fecha_vencimiento, i.fecha_cobro)).length,
    cobradas: all.filter((i) => !!i.fecha_cobro).length,
  };

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Cuentas por cobrar</h1>
        <p className="text-muted-foreground">
          Lo que te deben los clientes este mes y cuándo. Lo más rápido es{" "}
          <b>Generar el mes</b> (crea el cobro de cada cliente con abono) y después
          marcás <b>cobrado</b> cuando te paguen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["pendientes", "vencidas", "cobradas", "todas"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/cobros?f=${k}${monthFilter ? `&m=${monthFilter}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
              k === "vencidas" && filter !== k && counts.vencidas > 0 && "border-red-300 text-red-700"
            )}
          >
            {labelFor(k)} ({counts[k]})
          </Link>
        ))}
        <MonthPicker value={monthFilter} />
      </div>

      <InvoicesTable rows={rows} rates={rates} clients={clients} />

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Generar los cobros del mes en bloque
          </div>
          <p className="text-xs text-muted-foreground">
            Crea de una el cobro de cada cliente activo con abono mensual cargado.
            No duplica si ya existían. Después solo marcás cobrado cuando te paguen.
          </p>
          <GenerateMonthButton kind="invoices" />
        </CardContent>
      </Card>
    </div>
  );
}

function labelFor(k: "pendientes" | "vencidas" | "cobradas" | "todas") {
  const m: Record<string, string> = {
    pendientes: "Pendientes",
    vencidas: "Vencidas",
    cobradas: "Cobradas",
    todas: "Todas",
  };
  return m[k];
}
