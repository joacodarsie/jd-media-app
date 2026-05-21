"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  generateMonthlyInvoices,
  generateMonthlyPayments,
} from "@/app/(app)/finanzas/actions";
import { currentPeriod, nextPeriod, periodLabel } from "@/lib/finanzas";

interface Props {
  kind: "invoices" | "payments";
}

export function GenerateMonthButton({ kind }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [periodo, setPeriodo] = useState(() => nextPeriod(currentPeriod()));

  function generate() {
    start(async () => {
      const res =
        kind === "invoices"
          ? await generateMonthlyInvoices(periodo)
          : await generateMonthlyPayments(periodo);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      const created = (res as { created?: number }).created ?? 0;
      if (created === 0) {
        if (kind === "payments") {
          toast.error(
            "No se generó nada. Asegurate de tener cargada la compensación mensual de cada persona (Equipo → Personas).",
            { duration: 7000 }
          );
        } else {
          toast.error(
            "No se generó nada. Asegurate de tener servicios mensuales cargados con monto en clientes activos.",
            { duration: 7000 }
          );
        }
      } else {
        toast.success(
          `${created} ${kind === "invoices" ? "factura(s)" : "pago(s)"} generado(s) para ${periodLabel(periodo)}.`
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Generar mes
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <div>
          <h4 className="text-sm font-semibold">
            Generar {kind === "invoices" ? "facturas" : "pagos"} del mes
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {kind === "invoices"
              ? "Crea una entrada por cada servicio activo de clientes activos."
              : "Crea una entrada por cada miembro del equipo con compensación recurrente."}{" "}
            No se duplica si ya existían.
          </p>
        </div>
        <div>
          <label className="text-xs">Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <Button
          onClick={generate}
          disabled={pending || !periodo}
          className="w-full"
          size="sm"
        >
          {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Generar para {periodLabel(periodo)}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
