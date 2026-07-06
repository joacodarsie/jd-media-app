"use client";

import { useMemo, useState } from "react";
import { Download, ArrowUp, ArrowDown } from "lucide-react";
import { fmtARS, periodLabel } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

export interface RegistryRow {
  periodo: string; // YYYY-MM
  ingresos: number; // cobrado en ARS
  sueldos: number; // pagado al equipo en ARS
  gastos: number; // gastos pagados en ARS
}

type Col = "periodo" | "ingresos" | "sueldos" | "gastos" | "egresos" | "neto";

/**
 * Registro tipo planilla: una fila por mes con lo cobrado, lo pagado al equipo,
 * los gastos, el neto y el crecimiento vs el mes anterior. Ordenable por
 * columna y descargable como CSV (se abre en Excel).
 */
export function FinancialRegistry({ rows }: { rows: RegistryRow[] }) {
  const [sortCol, setSortCol] = useState<Col>("periodo");
  const [asc, setAsc] = useState(false);

  // Enriquecemos con egreso, neto y crecimiento (necesita orden cronológico).
  const enriched = useMemo(() => {
    const chrono = [...rows].sort((a, b) => a.periodo.localeCompare(b.periodo));
    return chrono.map((r, i) => {
      const egresos = r.sueldos + r.gastos;
      const neto = r.ingresos - egresos;
      const prev = i > 0 ? chrono[i - 1] : null;
      const prevNeto = prev ? prev.ingresos - (prev.sueldos + prev.gastos) : null;
      const deltaNeto = prevNeto != null ? neto - prevNeto : null;
      return { ...r, egresos, neto, deltaNeto };
    });
  }, [rows]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      const av = a[sortCol] as number | string;
      const bv = b[sortCol] as number | string;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [enriched, sortCol, asc]);

  const totals = useMemo(() => {
    const ingresos = enriched.reduce((a, r) => a + r.ingresos, 0);
    const sueldos = enriched.reduce((a, r) => a + r.sueldos, 0);
    const gastos = enriched.reduce((a, r) => a + r.gastos, 0);
    return { ingresos, sueldos, gastos, egresos: sueldos + gastos, neto: ingresos - sueldos - gastos };
  }, [enriched]);

  function toggle(col: Col) {
    if (col === sortCol) setAsc((v) => !v);
    else {
      setSortCol(col);
      setAsc(col === "periodo");
    }
  }

  function downloadCsv() {
    const head = ["Mes", "Ingresos (cobrado)", "Sueldos", "Gastos", "Egresos", "Neto", "Crecimiento neto"];
    const lines = [...enriched]
      .sort((a, b) => b.periodo.localeCompare(a.periodo))
      .map((r) =>
        [
          periodLabel(r.periodo),
          r.ingresos,
          r.sueldos,
          r.gastos,
          r.egresos,
          r.neto,
          r.deltaNeto ?? "",
        ].join(";")
      );
    const csv = [head.join(";"), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registro-jd-media.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ col, label, right }: { col: Col; label: string; right?: boolean }) => (
    <th
      className={cn("cursor-pointer select-none px-3 py-2 font-medium hover:text-foreground", right && "text-right")}
      onClick={() => toggle(col)}
    >
      <span className={cn("inline-flex items-center gap-1", right && "flex-row-reverse")}>
        {label}
        {sortCol === col &&
          (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> Descargar Excel (CSV)
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <Th col="periodo" label="Mes" />
              <Th col="ingresos" label="Ingresos" right />
              <Th col="sueldos" label="Sueldos" right />
              <Th col="gastos" label="Gastos" right />
              <Th col="egresos" label="Egresos" right />
              <Th col="neto" label="Neto" right />
              <th className="px-3 py-2 text-right font-medium">Crecimiento</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Todavía no hay movimientos cargados.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const vacio = r.ingresos === 0 && r.egresos === 0;
                return (
                  <tr key={r.periodo} className={cn("border-b last:border-0", vacio && "opacity-40")}>
                    <td className="px-3 py-2 font-medium capitalize">{periodLabel(r.periodo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtARS(r.ingresos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtARS(r.sueldos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtARS(r.gastos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmtARS(r.egresos)}</td>
                    <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.neto < 0 ? "text-red-600" : "text-emerald-600")}>
                      {fmtARS(r.neto)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.deltaNeto == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-0.5", r.deltaNeto >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {r.deltaNeto >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {fmtARS(Math.abs(r.deltaNeto))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtARS(totals.ingresos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtARS(totals.sueldos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtARS(totals.gastos)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmtARS(totals.egresos)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", totals.neto < 0 ? "text-red-600" : "text-emerald-600")}>
                  {fmtARS(totals.neto)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cada fila es un mes. <b>Ingresos</b> = lo cobrado; <b>Sueldos</b> = pagado
        al equipo; <b>Gastos</b> = gastos pagados; <b>Neto</b> = ingresos − egresos;
        <b> Crecimiento</b> = variación del neto vs el mes anterior. Tocá una columna
        para ordenar. Montos en ARS al dólar de hoy (meses viejos aproximados).
      </p>
    </div>
  );
}
