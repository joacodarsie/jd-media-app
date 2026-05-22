"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toARS,
  fmtARS,
  fmtCurrency,
  isOverdue,
} from "@/lib/finanzas";
import type { ExchangeRates } from "@/lib/exchange";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import {
  InvoiceFormDialog,
  type ClientForInvoice,
} from "@/components/invoice-form-dialog";

export interface InvoiceTableRow {
  id: string;
  cliente_id: string;
  monto: number;
  moneda: string;
  periodo: string;
  concepto: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  fecha_cobro: string | null;
  metodo_pago: string | null;
  notas: string | null;
  cliente: { id: string; nombre: string } | null;
}

type SortKey = "cliente" | "vence" | "monto" | "periodo";

export function InvoicesTable({
  rows,
  rates,
  clients,
}: {
  rows: InvoiceTableRow[];
  rates: ExchangeRates;
  clients: ClientForInvoice[];
}) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("vence");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(k: SortKey) {
    if (k === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(k);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = term
      ? rows.filter(
          (r) =>
            r.cliente?.nombre.toLowerCase().includes(term) ||
            r.concepto.toLowerCase().includes(term) ||
            r.periodo.includes(term)
        )
      : rows;
    list = [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "cliente":
          return ((a.cliente?.nombre ?? "").localeCompare(b.cliente?.nombre ?? "")) * mul;
        case "vence": {
          const av = a.fecha_vencimiento ?? "9999-12-31";
          const bv = b.fecha_vencimiento ?? "9999-12-31";
          return av.localeCompare(bv) * mul;
        }
        case "monto":
          return (toARS(Number(a.monto), a.moneda, rates) - toARS(Number(b.monto), b.moneda, rates)) * mul;
        case "periodo":
          return a.periodo.localeCompare(b.periodo) * mul;
      }
    });
    return list;
  }, [rows, q, sortBy, sortDir, rates]);

  const total = filtered.reduce(
    (acc, i) => acc + toARS(Number(i.monto), i.moneda, rates),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, concepto, período…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <InvoiceFormDialog
          mode="create"
          clients={clients}
          trigger={
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nueva factura
            </Button>
          }
        />
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} ítem(s) · <b className="text-foreground">{fmtARS(total)}</b>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Sin resultados.
          </p>
        ) : (
          filtered.map((i) => {
            const overdue = isOverdue(i.fecha_vencimiento, i.fecha_cobro);
            return (
              <div
                key={i.id}
                className={cn(
                  "rounded-md border bg-card p-3 text-sm",
                  overdue && "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{i.cliente?.nombre ?? "—"}</div>
                    <p className="truncate text-xs text-muted-foreground" title={i.concepto}>
                      {i.concepto}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">
                      {fmtCurrency(Number(i.monto), i.moneda)}
                    </div>
                    {i.moneda !== "ARS" && (
                      <div className="text-[10px] text-muted-foreground">
                        {fmtARS(toARS(Number(i.monto), i.moneda, rates))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex gap-2 text-muted-foreground">
                    <span>{i.periodo}</span>
                    <span>·</span>
                    <span className={cn(overdue && "font-semibold text-red-700")}>
                      Vence{" "}
                      {i.fecha_vencimiento
                        ? new Date(i.fecha_vencimiento).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                      {overdue && " · venc."}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MarkPaidButton id={i.id} kind="invoice" paidAt={i.fecha_cobro} />
                    <InvoiceFormDialog
                      mode="edit"
                      clients={clients}
                      invoice={{
                        id: i.id,
                        cliente_id: i.cliente_id,
                        concepto: i.concepto,
                        monto: Number(i.monto),
                        moneda: i.moneda,
                        periodo: i.periodo,
                        fecha_vencimiento: i.fecha_vencimiento,
                        notas: i.notas,
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden rounded-md border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <Th onClick={() => toggleSort("cliente")} active={sortBy === "cliente"} dir={sortDir}>
                  Cliente
                </Th>
                <th className="px-3 py-2">Concepto</th>
                <Th onClick={() => toggleSort("periodo")} active={sortBy === "periodo"} dir={sortDir}>
                  Período
                </Th>
                <Th onClick={() => toggleSort("vence")} active={sortBy === "vence"} dir={sortDir}>
                  Vence
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
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const overdue = isOverdue(i.fecha_vencimiento, i.fecha_cobro);
                  return (
                    <tr
                      key={i.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30",
                        overdue && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-3 py-2 font-medium">{i.cliente?.nombre ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground" title={i.concepto}>
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
                        {overdue && " · venc."}
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
                      <td className="px-1 py-2">
                        <InvoiceFormDialog
                          mode="edit"
                          clients={clients}
                          invoice={{
                            id: i.id,
                            cliente_id: i.cliente_id,
                            concepto: i.concepto,
                            monto: Number(i.monto),
                            moneda: i.moneda,
                            periodo: i.periodo,
                            fecha_vencimiento: i.fecha_vencimiento,
                            notas: i.notas,
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Editar"
                            >
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
