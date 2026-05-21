import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { isOverdue } from "@/lib/finanzas";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { InvoicesTable, type InvoiceTableRow } from "@/components/invoices-table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todas" | "pendientes" | "vencidas" | "cobradas";

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todas", "pendientes", "vencidas", "cobradas"].includes(filterParam)
    ? filterParam
    : "pendientes";

  const [{ data: invoicesData }, { data: clientsData }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, cliente_id, monto, moneda, periodo, concepto, fecha_emision, fecha_vencimiento, fecha_cobro, metodo_pago, notas, cliente:clients(id,nombre)"
      )
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, nombre")
      .eq("estado", "activo")
      .order("nombre"),
  ]);

  const all = (invoicesData ?? []) as unknown as InvoiceTableRow[];
  const clients = (clientsData ?? []) as { id: string; nombre: string }[];

  const rows = all.filter((i) => {
    if (filter === "pendientes") return !i.fecha_cobro;
    if (filter === "cobradas") return !!i.fecha_cobro;
    if (filter === "vencidas") return isOverdue(i.fecha_vencimiento, i.fecha_cobro);
    return true;
  });

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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por cobrar</h1>
          <p className="text-muted-foreground">
            Lo que te deben los clientes — y cuándo te tienen que pagar.
          </p>
        </div>
        <GenerateMonthButton kind="invoices" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pendientes", "vencidas", "cobradas", "todas"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/cobros?f=${k}`}
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
      </div>

      <InvoicesTable rows={rows} rates={rates} clients={clients} />
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
