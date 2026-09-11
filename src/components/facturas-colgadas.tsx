"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarFacturaCobrada, borrarFactura } from "@/app/(app)/cobros/actions";
import { periodLabel } from "@/lib/finanzas";
import { CLIENT_STATUS_LABEL } from "@/lib/constants";
import type { FacturaColgada } from "@/lib/finanzas/cobros-mes";

/**
 * Lo que quedó colgado: facturas sin cobrar de meses anteriores y de cuentas
 * que ya no están.
 *
 * Va en un bloque aparte y NO suma al "falta cobrar" del mes a propósito. Seis
 * facturas viejas de cuentas dadas de baja inflaban el pendiente en $1,4M y por
 * eso el número del mes no se podía usar para decidir nada. Acá cada una se
 * cierra en un clic: o entró la plata, o la factura nunca debió existir.
 */
export function FacturasColgadas({ facturas }: { facturas: FacturaColgada[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [abierto, setAbierto] = useState(false);

  if (!facturas.length) return null;

  // Lo que falta DE VERDAD: si entregó una parte, la deuda es el saldo.
  const saldo = (f: FacturaColgada) => Math.max(f.monto - f.entregado, 0);
  const total = facturas.reduce((a, f) => a + saldo(f), 0);
  const deBaja = facturas.filter((f) => f.motivo === "cuenta_de_baja").length;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {abierto ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Quedó colgado de antes: {facturas.length}{" "}
            {facturas.length === 1 ? "factura" : "facturas"} sin cobrar
          </p>
          <p className="text-xs text-muted-foreground">
            ${total.toLocaleString("es-AR")} en total
            {deBaja > 0 && ` · ${deBaja} de cuentas que ya no están`}. No cuenta en el mes.
          </p>
        </div>
      </button>

      {abierto && (
        <ul className="divide-y border-t">
          {facturas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{f.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {periodLabel(f.periodo)} · ${saldo(f).toLocaleString("es-AR")}
                  {f.entregado > 0 &&
                    ` (de $${f.monto.toLocaleString("es-AR")}, ya entregó $${f.entregado.toLocaleString("es-AR")})`}{" "}
                  ·{" "}
                  {f.motivo === "cuenta_de_baja"
                    ? `la cuenta figura ${(CLIENT_STATUS_LABEL[f.estado as keyof typeof CLIENT_STATUS_LABEL] ?? f.estado).toLowerCase()}`
                    : "mes anterior"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await marcarFacturaCobrada(f.id);
                    if ("error" in res && res.error) toast.error(res.error);
                    else toast.success(`${f.nombre}: cobrada ✅`);
                    router.refresh();
                  })
                }
              >
                <Check className="mr-1.5 h-4 w-4" /> Sí me pagó
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                title="Esta factura no va: borrarla"
                onClick={() => {
                  if (
                    !confirm(
                      `Borrar la factura de ${f.nombre} de ${periodLabel(f.periodo)} por $${f.monto.toLocaleString("es-AR")}?\n\nUsalo cuando esa factura nunca debió emitirse. Si te la pagaron, marcá "Sí me pagó".`
                    )
                  )
                    return;
                  start(async () => {
                    const res = await borrarFactura(f.id);
                    if ("error" in res && res.error) toast.error(res.error);
                    else toast.success("Borrada");
                    router.refresh();
                  });
                }}
                className="text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
