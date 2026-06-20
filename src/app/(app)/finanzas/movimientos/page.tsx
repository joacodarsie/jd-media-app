import Link from "next/link";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireFeature } from "@/lib/auth";
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

type Filtro = "todos" | "in" | "out";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();
  const filtro: Filtro =
    searchParams.t === "in" ? "in" : searchParams.t === "out" ? "out" : "todos";

  const [{ data: invs }, { data: pays }, { data: exps }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, monto, moneda, fecha_cobro, concepto, metodo_pago, cliente:clients(nombre)"
      )
      .not("fecha_cobro", "is", null)
      .order("fecha_cobro", { ascending: false })
      .limit(300),
    supabase
      .from("team_payments")
      .select(
        "id, monto, moneda, fecha_pago, concepto, metodo_pago, usuario:users!team_payments_user_id_fkey(nombre)"
      )
      .not("fecha_pago", "is", null)
      .order("fecha_pago", { ascending: false })
      .limit(300),
    supabase
      .from("expenses")
      .select("id, monto, moneda, fecha_pago, concepto, metodo_pago, proveedor, categoria")
      .not("fecha_pago", "is", null)
      .order("fecha_pago", { ascending: false })
      .limit(300),
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

  const egresosEquipo: Movement[] = ((pays ?? []) as unknown as {
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
    concepto: "Equipo · " + p.concepto,
    contraparte: p.usuario?.nombre ?? "—",
    metodo: p.metodo_pago,
  }));

  const egresosGastos: Movement[] = ((exps ?? []) as unknown as {
    id: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
    concepto: string;
    metodo_pago: string | null;
    proveedor: string | null;
    categoria: string;
  }[]).map((e) => ({
    id: "exp_" + e.id,
    kind: "out",
    fecha: e.fecha_pago,
    monto: Number(e.monto),
    moneda: e.moneda,
    concepto: `${e.categoria} · ${e.concepto}`,
    contraparte: e.proveedor ?? "—",
    metodo: e.metodo_pago,
  }));

  const todos = [...ingresos, ...egresosEquipo, ...egresosGastos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha)
  );

  // Totales globales (sobre todo el historial cargado, sin filtrar) en ARS.
  const totalIn = todos
    .filter((m) => m.kind === "in")
    .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);
  const totalOut = todos
    .filter((m) => m.kind === "out")
    .reduce((a, m) => a + toARS(m.monto, m.moneda, rates), 0);

  // Aplicar filtro de tipo a lo que se muestra.
  const all =
    filtro === "todos" ? todos : todos.filter((m) => m.kind === filtro);

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
          Historial completo de todo lo que entró y salió: cobros, pagos al
          equipo y gastos, mes a mes.
        </p>
      </div>

      {/* Resumen del historial */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Entró" value={fmtARS(totalIn)} tone="in" />
        <SummaryCard label="Salió" value={fmtARS(totalOut)} tone="out" />
        <SummaryCard
          label="Neto"
          value={fmtARS(totalIn - totalOut)}
          tone={totalIn - totalOut >= 0 ? "in" : "out"}
        />
      </div>

      {/* Filtro por tipo */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "todos", label: "Todos", href: "/finanzas/movimientos" },
            { key: "in", label: "Ingresos", href: "/finanzas/movimientos?t=in" },
            { key: "out", label: "Egresos", href: "/finanzas/movimientos?t=out" },
          ] as const
        ).map((opt) => (
          <Link
            key={opt.key}
            href={opt.href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filtro === opt.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </Link>
        ))}
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "in" | "out";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-bold tabular-nums sm:text-lg",
          tone === "in" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
        )}
      >
        {value}
      </div>
    </div>
  );
}
