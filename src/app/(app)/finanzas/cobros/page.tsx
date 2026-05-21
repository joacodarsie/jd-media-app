import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, fmtCurrency, isOverdue } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  monto: number;
  moneda: string;
  periodo: string;
  concepto: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  fecha_cobro: string | null;
  metodo_pago: string | null;
  cliente: { id: string; nombre: string } | null;
}

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

  const { data } = await supabase
    .from("client_invoices")
    .select(
      "id, monto, moneda, periodo, concepto, fecha_emision, fecha_vencimiento, fecha_cobro, metodo_pago, cliente:clients(id,nombre)"
    )
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const all = (data ?? []) as unknown as InvoiceRow[];

  const rows = all.filter((i) => {
    if (filter === "pendientes") return !i.fecha_cobro;
    if (filter === "cobradas") return !!i.fecha_cobro;
    if (filter === "vencidas") return isOverdue(i.fecha_vencimiento, i.fecha_cobro);
    return true;
  });

  const total = rows.reduce((acc, i) => acc + toARS(Number(i.monto), i.moneda, rates), 0);

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

      {/* Tabs filtro */}
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
            {label(k)} ({counts[k]})
          </Link>
        ))}
        <div className="ml-auto text-sm text-muted-foreground">
          Total: <b className="text-foreground">{fmtARS(total)}</b>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay facturas en esta vista.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Vence</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const overdue = isOverdue(i.fecha_vencimiento, i.fecha_cobro);
                    return (
                      <tr
                        key={i.id}
                        className={cn("border-b last:border-0", overdue && "bg-red-50/40 dark:bg-red-950/10")}
                      >
                        <td className="px-3 py-2 font-medium">
                          {i.cliente?.nombre ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {i.concepto}
                        </td>
                        <td className="px-3 py-2 text-xs">{i.periodo}</td>
                        <td className={cn("px-3 py-2 text-xs", overdue && "font-semibold text-red-700")}>
                          {i.fecha_vencimiento
                            ? new Date(i.fecha_vencimiento).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "—"}
                          {overdue && " · vencida"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <div className="font-semibold">{fmtCurrency(Number(i.monto), i.moneda)}</div>
                          {i.moneda !== "ARS" && (
                            <div className="text-[10px] text-muted-foreground">
                              {fmtARS(toARS(Number(i.monto), i.moneda, rates))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <MarkPaidButton id={i.id} kind="invoice" paidAt={i.fecha_cobro} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function label(k: "pendientes" | "vencidas" | "cobradas" | "todas") {
  const m: Record<string, string> = {
    pendientes: "Pendientes",
    vencidas: "Vencidas",
    cobradas: "Cobradas",
    todas: "Todas",
  };
  return m[k];
}
