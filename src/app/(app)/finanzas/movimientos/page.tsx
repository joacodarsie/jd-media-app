import Link from "next/link";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Movement {
  id: string;
  kind: "in" | "out";
  fecha: string;
  monto: number;
  moneda: string;
  concepto: string;
  contraparte: string;
  metodo: string | null;
}

export default async function MovimientosPage() {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();

  const [{ data: invs }, { data: pays }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, monto, moneda, fecha_cobro, concepto, metodo_pago, cliente:clients(nombre)"
      )
      .not("fecha_cobro", "is", null)
      .order("fecha_cobro", { ascending: false })
      .limit(200),
    supabase
      .from("team_payments")
      .select(
        "id, monto, moneda, fecha_pago, concepto, metodo_pago, usuario:users!team_payments_user_id_fkey(nombre)"
      )
      .not("fecha_pago", "is", null)
      .order("fecha_pago", { ascending: false })
      .limit(200),
  ]);

  const ingresos: Movement[] = ((invs ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_cobro: string;
    concepto: string;
    metodo_pago: string | null;
    cliente: { nombre: string } | null;
  }[]).map((i) => ({
    id: "in_" + i.id,
    kind: "in",
    fecha: i.fecha_cobro,
    monto: Number(i.monto),
    moneda: i.moneda,
    concepto: i.concepto,
    contraparte: i.cliente?.nombre ?? "—",
    metodo: i.metodo_pago,
  }));

  const egresos: Movement[] = ((pays ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
    concepto: string;
    metodo_pago: string | null;
    usuario: { nombre: string } | null;
  }[]).map((p) => ({
    id: "out_" + p.id,
    kind: "out",
    fecha: p.fecha_pago,
    monto: Number(p.monto),
    moneda: p.moneda,
    concepto: p.concepto,
    contraparte: p.usuario?.nombre ?? "—",
    metodo: p.metodo_pago,
  }));

  const all = [...ingresos, ...egresos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Agrupar por mes
  const byMonth = new Map<string, Movement[]>();
  for (const m of all) {
    const k = m.fecha.slice(0, 7); // YYYY-MM
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(m);
  }

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Movimientos</h1>
        <p className="text-muted-foreground">
          Historial unificado de cobros e ingresos efectivos al equipo.
        </p>
      </div>

      {all.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos. Cobrá una factura o pagá un sueldo desde
            las páginas correspondientes y vas a verlo acá.
          </CardContent>
        </Card>
      ) : (
        Array.from(byMonth.entries()).map(([month, items]) => {
          const ingMonth = items
            .filter((m) => m.kind === "in")
            .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
          const egrMonth = items
            .filter((m) => m.kind === "out")
            .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
          const monthDate = new Date(month + "-01");
          return (
            <section key={month} className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-base font-semibold capitalize">
                  {monthDate.toLocaleDateString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-700">↓ {fmtARS(ingMonth)}</span>
                  <span className="text-amber-700">↑ {fmtARS(egrMonth)}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      ingMonth - egrMonth >= 0 ? "text-foreground" : "text-red-700"
                    )}
                  >
                    Neto: {fmtARS(ingMonth - egrMonth)}
                  </span>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {items.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            m.kind === "in"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {m.kind === "in" ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{m.contraparte}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {m.concepto}
                            {m.metodo && ` · ${m.metodo}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={cn(
                              "font-semibold tabular-nums",
                              m.kind === "in" ? "text-emerald-700" : "text-amber-700"
                            )}
                          >
                            {m.kind === "in" ? "+" : "−"}
                            {fmtCurrency(m.monto, m.moneda)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(m.fecha).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
