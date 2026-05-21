import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { PaymentsTable, type PaymentTableRow } from "@/components/payments-table";
import { MonthPicker } from "@/components/month-picker";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todos" | "pendientes" | "atrasados" | "pagados";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createClient();
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todos", "pendientes", "atrasados", "pagados"].includes(filterParam)
    ? filterParam
    : "pendientes";
  const monthFilter =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : null;

  const [{ data: paymentsData }, { data: usersData }] = await Promise.all([
    supabase
      .from("team_payments")
      .select(
        "id, user_id, monto, moneda, periodo, concepto, fecha_programada, fecha_pago, metodo_pago, notas, usuario:users!team_payments_user_id_fkey(id,nombre)"
      )
      .order("fecha_programada", { ascending: true }),
    supabase
      .from("users")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const all = (paymentsData ?? []) as unknown as PaymentTableRow[];
  const users = (usersData ?? []) as { id: string; nombre: string }[];
  const today = new Date().toISOString().slice(0, 10);

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
  const byUser = new Map<string, { nombre: string; pendientes: number; totalARS: number }>();
  for (const p of all.filter((x) => !x.fecha_pago)) {
    if (!p.usuario) continue;
    const k = p.usuario.id;
    if (!byUser.has(k)) byUser.set(k, { nombre: p.usuario.nombre, pendientes: 0, totalARS: 0 });
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
        <MonthPicker
          value={monthFilter}
          buildHref={(m) => `/finanzas/pagos?f=${filter}${m ? `&m=${m}` : ""}`}
        />
      </div>

      <PaymentsTable rows={rows} rates={rates} users={users} />
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
