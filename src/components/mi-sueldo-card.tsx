import { Wallet, Check } from "lucide-react";
import { fmtARS, periodLabel } from "@/lib/finanzas";
import type { PersonPayroll } from "@/lib/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

/**
 * Vista read-only del sueldo del mes en curso para la persona logueada: el
 * desglose (cada cuenta/concepto) y el total. Calculado con el mismo modelo que
 * usa Coordinación, así cada colaborador ve con claridad lo que va a cobrar.
 */
export function MiSueldoCard({
  person,
  periodo,
}: {
  person: PersonPayroll | null;
  periodo: string;
}) {
  const lines = [
    ...(person?.autoLines ?? []),
    ...(person?.manualItems.map((it) => ({
      clienteId: null,
      cliente: it.cliente ?? "—",
      concepto: it.concepto,
      monto: it.monto,
      kind: it.tipo,
    })) ?? []),
  ];

  const total = person?.total ?? 0;
  const tieneDetalle = lines.length > 0;

  // Texto para copiar (mismo formato que el mensaje de Coordinación).
  const detalle =
    person && tieneDetalle
      ? `Mi sueldo de ${periodLabel(periodo)}:\n\n` +
        lines
          .map((l) => {
            const pref = l.cliente && l.cliente !== "—" ? `${l.cliente} — ` : "";
            return `• ${pref}${l.concepto}: ${fmtARS(l.monto)}`;
          })
          .join("\n") +
        `\n\nTotal: ${fmtARS(total)}`
      : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" /> Mi próximo sueldo
          </span>
          <span className="text-xs font-normal capitalize text-muted-foreground">
            {periodLabel(periodo)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!tieneDetalle ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay conceptos cargados para este mes. A medida que se
            publiquen piezas, se carguen comisiones o jornadas, vas a verlos
            acá con el total actualizado.
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Total estimado del mes
                </div>
                <div className="text-3xl font-bold tabular-nums text-emerald-600">
                  {fmtARS(total)}
                </div>
              </div>
              {person?.registrado && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    person.pagado
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {person.pagado ? "Ya te pagamos este mes" : "Pago registrado"}
                </span>
              )}
            </div>

            <ul className="divide-y rounded-lg border text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    {l.cliente && l.cliente !== "—" && (
                      <span className="font-medium">{l.cliente}</span>
                    )}{" "}
                    <span className="text-muted-foreground">{l.concepto}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      l.monto < 0 && "text-red-600"
                    )}
                  >
                    {fmtARS(l.monto)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Estimado del mes en curso. Puede cambiar si se agregan piezas,
                comisiones o ajustes antes del cierre.
              </p>
              {detalle && (
                <CopyButton
                  value={detalle}
                  label="Copiar detalle"
                  className="rounded-md border px-2.5 py-1 text-xs"
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
