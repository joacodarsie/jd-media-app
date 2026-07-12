"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { SortTh } from "@/components/ui/sort-th";
import { cn } from "@/lib/utils";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import type { ExchangeRates } from "@/lib/exchange";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import {
  PaymentFormDialog,
  type UserForPayment,
} from "@/components/payment-form-dialog";

export interface PaymentTableRow {
  id: string;
  user_id: string;
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

type SortKey = "persona" | "fecha" | "monto" | "periodo";

export function PaymentsTable({
  rows,
  rates,
  users,
  clients,
}: {
  rows: PaymentTableRow[];
  rates: ExchangeRates;
  users: UserForPayment[];
  clients?: { id: string; nombre: string }[];
}) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
            r.usuario?.nombre.toLowerCase().includes(term) ||
            r.concepto.toLowerCase().includes(term) ||
            r.periodo.includes(term)
        )
      : rows;
    list = [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "persona":
          return ((a.usuario?.nombre ?? "").localeCompare(b.usuario?.nombre ?? "")) * mul;
        case "fecha":
          return a.fecha_programada.localeCompare(b.fecha_programada) * mul;
        case "monto":
          return (toARS(Number(a.monto), a.moneda, rates) - toARS(Number(b.monto), b.moneda, rates)) * mul;
        case "periodo":
          return a.periodo.localeCompare(b.periodo) * mul;
      }
    });
    return list;
  }, [rows, q, sortBy, sortDir, rates]);

  const total = filtered.reduce(
    (acc, p) => acc + toARS(Number(p.monto), p.moneda, rates),
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
            placeholder="Buscar persona, concepto, período…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <PaymentFormDialog
          mode="create"
          users={users}
          clients={clients}
          trigger={
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nuevo pago
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
          filtered.map((p) => {
            const atrasado = !p.fecha_pago && p.fecha_programada < today;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-md border bg-card p-3 text-sm",
                  atrasado && "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.usuario?.nombre ?? "—"}</div>
                    <p className="truncate text-xs text-muted-foreground" title={p.concepto}>
                      {p.concepto}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">
                      {fmtCurrency(Number(p.monto), p.moneda)}
                    </div>
                    {p.moneda !== "ARS" && (
                      <div className="text-[10px] text-muted-foreground">
                        {fmtARS(toARS(Number(p.monto), p.moneda, rates))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex gap-2 text-muted-foreground">
                    <span>{p.periodo}</span>
                    <span>·</span>
                    <span className={cn(atrasado && "font-semibold text-red-700")}>
                      {new Date(p.fecha_programada).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                      {atrasado && " · atras."}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MarkPaidButton id={p.id} kind="payment" paidAt={p.fecha_pago} />
                    <PaymentFormDialog
                      mode="edit"
                      users={users}
                      payment={{
                        id: p.id,
                        user_id: p.user_id,
                        concepto: p.concepto,
                        monto: Number(p.monto),
                        moneda: p.moneda,
                        periodo: p.periodo,
                        fecha_programada: p.fecha_programada,
                        notas: p.notas,
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
                <SortTh onClick={() => toggleSort("persona")} active={sortBy === "persona"} dir={sortDir}>
                  Persona
                </SortTh>
                <th className="px-3 py-2">Concepto</th>
                <SortTh onClick={() => toggleSort("periodo")} active={sortBy === "periodo"} dir={sortDir}>
                  Período
                </SortTh>
                <SortTh onClick={() => toggleSort("fecha")} active={sortBy === "fecha"} dir={sortDir}>
                  Programado
                </SortTh>
                <SortTh onClick={() => toggleSort("monto")} active={sortBy === "monto"} dir={sortDir} align="right">
                  Monto
                </SortTh>
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
                filtered.map((p) => {
                  const atrasado = !p.fecha_pago && p.fecha_programada < today;
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30",
                        atrasado && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <td className="px-3 py-2 font-medium">{p.usuario?.nombre ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground" title={p.concepto}>
                        {p.concepto}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.periodo}</td>
                      <td className={cn("px-3 py-2 text-xs", atrasado && "font-semibold text-red-700")}>
                        {new Date(p.fecha_programada).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {atrasado && " · atras."}
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
                      <td className="px-1 py-2">
                        <PaymentFormDialog
                          mode="edit"
                          users={users}
                          clients={clients}
                          payment={{
                            id: p.id,
                            user_id: p.user_id,
                            concepto: p.concepto,
                            monto: Number(p.monto),
                            moneda: p.moneda,
                            periodo: p.periodo,
                            fecha_programada: p.fecha_programada,
                            notas: p.notas,
                            cliente_id: (p as unknown as { cliente_id?: string | null }).cliente_id ?? null,
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

