import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  monto: number;
  moneda: string;
  periodo: string;
  concepto: string;
  fecha_programada: string;
  fecha_pago: string | null;
  metodo_pago: string | null;
  notas: string | null;
  usuario: { id: string; nombre: string } | null;
}

type Filter = "todos" | "pendientes" | "atrasados" | "pagados";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todos", "pendientes", "atrasados", "pagados"].includes(filterParam)
    ? filterParam
    : "pendientes";

  const { data } = await supabase
    .from("team_payments")
    .select(
      "id, monto, moneda, periodo, concepto, fecha_programada, fecha_pago, metodo_pago, notas, usuario:users!team_payments_user_id_fkey(id,nombre)"
    )
    .order("fecha_programada", { ascending: true });

  const all = (data ?? []) as unknown as PaymentRow[];
  const today = new Date().toISOString().slice(0, 10);

  const rows = all.filter((p) => {
    if (filter === "pendientes") return !p.fecha_pago;
    if (filter === "pagados") return !!p.fecha_pago;
    if (filter === "atrasados") return !p.fecha_pago && p.fecha_programada < today;
    return true;
  });

  const total = rows.reduce((acc, p) => acc + toARS(Number(p.monto), p.moneda, rates), 0);

  const counts = {
    todos: all.length,
    pendientes: all.filter((p) => !p.fecha_pago).length,
    atrasados: all.filter((p) => !p.fecha_pago && p.fecha_programada < today).length,
    pagados: all.filter((p) => !!p.fecha_pago).length,
  };

  // agrupar por persona para vista resumen
  const byUser = new Map<string, { nombre: string; pendientes: number; totalARS: number }>();
  for (const p of all.filter((x) => !x.fecha_pago)) {
    if (!p.usuario) continue;
    const k = p.usuario.id;
    if (!byUser.has(k)) {
      byUser.set(k, { nombre: p.usuario.nombre, pendientes: 0, totalARS: 0 });
    }
    const e = byUser.get(k)!;
    e.pendientes += 1;
    e.totalARS += toARS(Number(p.monto), p.moneda, rates);
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagos al equipo</h1>
          <p className="text-muted-foreground">
            Lo que tenés que pagar a cada miembro y cuándo.
          </p>
        </div>
        <GenerateMonthButton kind="payments" />
      </div>

      {/* Resumen por persona */}
      {porPersona.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pendiente por persona
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {porPersona.map(([id, p]) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.pendientes} pago{p.pendientes !== 1 ? "s" : ""} pendiente{p.pendientes !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{fmtARS(p.totalARS)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs filtro */}
      <div className="flex flex-wrap gap-2">
        {(["pendientes", "atrasados", "pagados", "todos"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/pagos?f=${k}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
              k === "atrasados" && filter !== k && counts.atrasados > 0 && "border-red-300 text-red-700"
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
              No hay pagos en esta vista.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Programado</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const atrasado = !p.fecha_pago && p.fecha_programada < today;
                    return (
                      <tr
                        key={p.id}
                        className={cn("border-b last:border-0", atrasado && "bg-red-50/40 dark:bg-red-950/10")}
                      >
                        <td className="px-3 py-2 font-medium">{p.usuario?.nombre ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.concepto}</td>
                        <td className="px-3 py-2 text-xs">{p.periodo}</td>
                        <td className={cn("px-3 py-2 text-xs", atrasado && "font-semibold text-red-700")}>
                          {new Date(p.fecha_programada).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          })}
                          {atrasado && " · atrasado"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <div className="font-semibold">{fmtCurrency(Number(p.monto), p.moneda)}</div>
                          {p.moneda !== "ARS" && (
                            <div className="text-[10px] text-muted-foreground">
                              {fmtARS(toARS(Number(p.monto), p.moneda, rates))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <MarkPaidButton id={p.id} kind="payment" paidAt={p.fecha_pago} />
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

function label(k: "pendientes" | "atrasados" | "pagados" | "todos") {
  const m: Record<string, string> = {
    pendientes: "Pendientes",
    atrasados: "Atrasados",
    pagados: "Pagados",
    todos: "Todos",
  };
  return m[k];
}
