"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import type { ExchangeRates } from "@/lib/exchange";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import {
  ExpenseFormDialog,
  EXPENSE_CATEGORIES,
} from "@/components/expense-form-dialog";
import { MonthPicker } from "@/components/month-picker";

export interface ExpenseTableRow {
  id: string;
  categoria:
    | "plataformas"
    | "ads"
    | "servicios"
    | "impuestos"
    | "bancos"
    | "oficina"
    | "equipamiento"
    | "otros";
  proveedor: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  periodo: string;
  fecha_programada: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  notas: string | null;
  recurrente: boolean;
}

type SortKey = "categoria" | "proveedor" | "fecha" | "monto" | "periodo";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label.split(" (")[0]])
);

export function ExpensesTable({
  rows,
  rates,
  filter,
  monthFilter,
}: {
  rows: ExpenseTableRow[];
  rates: ExchangeRates;
  filter: "todos" | "pendientes" | "pagados";
  monthFilter: string | null;
}) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(k: SortKey) {
    if (k === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(k);
      setSortDir("asc");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = term
      ? rows.filter(
          (r) =>
            (r.proveedor ?? "").toLowerCase().includes(term) ||
            r.concepto.toLowerCase().includes(term) ||
            r.categoria.includes(term) ||
            r.periodo.includes(term)
        )
      : rows;
    list = [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "categoria":
          return a.categoria.localeCompare(b.categoria) * mul;
        case "proveedor":
          return (a.proveedor ?? "").localeCompare(b.proveedor ?? "") * mul;
        case "fecha": {
          const ad = a.fecha_pago ?? a.fecha_programada ?? "0000-01-01";
          const bd = b.fecha_pago ?? b.fecha_programada ?? "0000-01-01";
          return ad.localeCompare(bd) * mul;
        }
        case "monto":
          return (toARS(Number(a.monto), a.moneda, rates) - toARS(Number(b.monto), b.moneda, rates)) * mul;
        case "periodo":
          return a.periodo.localeCompare(b.periodo) * mul;
      }
    });
    return list;
  }, [rows, q, sortBy, sortDir, rates]);

  const total = filtered.reduce((acc, e) => acc + toARS(Number(e.monto), e.moneda, rates), 0);

  return (
    <div className="space-y-3">
      {/* Tabs filtro + filtro mes */}
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "pendientes", "pagados"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/gastos?f=${k}${monthFilter ? `&m=${monthFilter}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            {labelFor(k)}
          </Link>
        ))}
        <MonthPicker
          value={monthFilter}
          buildHref={(m) => `/finanzas/gastos?f=${filter}${m ? `&m=${m}` : ""}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar proveedor, concepto…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <ExpenseFormDialog
          mode="create"
          trigger={
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nuevo gasto
            </Button>
          }
        />
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} ítem(s) · <b className="text-foreground">{fmtARS(total)}</b>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <Th onClick={() => toggleSort("categoria")} active={sortBy === "categoria"} dir={sortDir}>
                  Categoría
                </Th>
                <Th onClick={() => toggleSort("proveedor")} active={sortBy === "proveedor"} dir={sortDir}>
                  Proveedor
                </Th>
                <th className="px-3 py-2">Concepto</th>
                <Th onClick={() => toggleSort("periodo")} active={sortBy === "periodo"} dir={sortDir}>
                  Período
                </Th>
                <Th onClick={() => toggleSort("fecha")} active={sortBy === "fecha"} dir={sortDir}>
                  Fecha
                </Th>
                <Th onClick={() => toggleSort("monto")} active={sortBy === "monto"} dir={sortDir} align="right">
                  Monto
                </Th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sin gastos en esta vista. Cargá uno con el botón <b>Nuevo gasto</b>.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const atrasado =
                    !e.fecha_pago && e.fecha_programada && e.fecha_programada < today;
                  const fechaShown = e.fecha_pago ?? e.fecha_programada;
                  return (
                    <tr
                      key={e.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30",
                        atrasado && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-3 py-2 text-xs">
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {CAT_LABEL[e.categoria] ?? e.categoria}
                        </span>
                        {e.recurrente && (
                          <span className="ml-1 text-[10px] text-muted-foreground">↺</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{e.proveedor ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground" title={e.concepto}>
                        {e.concepto}
                      </td>
                      <td className="px-3 py-2 text-xs">{e.periodo}</td>
                      <td className={cn("px-3 py-2 text-xs", atrasado && "font-semibold text-red-700")}>
                        {fechaShown
                          ? new Date(fechaShown).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                        {atrasado && " · atras."}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div className="font-semibold">{fmtCurrency(Number(e.monto), e.moneda)}</div>
                        {e.moneda !== "ARS" && (
                          <div className="text-[10px] text-muted-foreground">
                            {fmtARS(toARS(Number(e.monto), e.moneda, rates))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <MarkPaidButton id={e.id} kind="expense" paidAt={e.fecha_pago} />
                      </td>
                      <td className="px-1 py-2">
                        <ExpenseFormDialog
                          mode="edit"
                          expense={{
                            id: e.id,
                            categoria: e.categoria,
                            proveedor: e.proveedor,
                            concepto: e.concepto,
                            monto: Number(e.monto),
                            moneda: e.moneda,
                            periodo: e.periodo,
                            fecha_programada: e.fecha_programada,
                            notas: e.notas,
                            recurrente: e.recurrente,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function labelFor(k: "todos" | "pendientes" | "pagados") {
  const m: Record<string, string> = {
    todos: "Todos",
    pendientes: "Pendientes",
    pagados: "Pagados",
  };
  return m[k];
}

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-3 py-2", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {children}
        <ArrowUpDown
          className={cn("h-3 w-3 opacity-50", active && "opacity-100", active && dir === "desc" && "rotate-180")}
        />
      </button>
    </th>
  );
}
