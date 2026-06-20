import { History } from "lucide-react";
import { fmtCurrency, periodLabel } from "@/lib/finanzas";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MovimientoEstado = "pagado" | "pendiente" | "vencido";

export interface MovimientoRow {
  id: string;
  concepto: string;
  periodo?: string | null;
  monto: number;
  moneda: string;
  estado: MovimientoEstado;
  /** Fecha relevante: de pago/cobro si ya ocurrió, si no de vencimiento/programada. */
  fecha: string | null;
}

const ESTADO_BADGE: Record<MovimientoEstado, string> = {
  pagado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  vencido: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/**
 * Lista compacta de movimientos (pagos al equipo o cobros a clientes) con su
 * estado. Presentacional: el caller arma las filas ya normalizadas. Muestra el
 * total cobrado/pagado del histórico que recibe.
 */
export function MovimientosHistorialCard({
  title,
  rows,
  estadoLabels,
  emptyText,
}: {
  title: string;
  rows: MovimientoRow[];
  /** Texto por estado, p.ej. {pagado:"Pagado", pendiente:"Pendiente", vencido:"Atrasado"}. */
  estadoLabels: Record<MovimientoEstado, string>;
  emptyText: string;
}) {
  const totalSaldado = rows
    .filter((r) => r.estado === "pagado")
    .reduce((a, r) => a + Number(r.monto), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <ul className="divide-y text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.concepto}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.periodo ? <span className="capitalize">{periodLabel(r.periodo)}</span> : null}
                      {r.periodo && r.fecha ? " · " : null}
                      {r.fecha ? fmtDate(r.fecha) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{fmtCurrency(Number(r.monto), r.moneda)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        ESTADO_BADGE[r.estado]
                      )}
                    >
                      {estadoLabels[r.estado]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {totalSaldado > 0 && (
              <div className="mt-3 flex justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>Total saldado (histórico mostrado)</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {fmtCurrency(totalSaldado, "ARS")}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
