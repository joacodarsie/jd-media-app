"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateMonthlyInvoices,
  generateMonthlyPayments,
} from "@/app/(app)/finanzas/actions";
import { periodLabel } from "@/lib/finanzas";

/**
 * Botón de "generar el mes" atado a un período fijo (el del asistente de cierre).
 * A diferencia de GenerateMonthButton, no pide el período: lo recibe por prop.
 */
export function MonthCloseGenerateButton({
  kind,
  periodo,
  label,
}: {
  kind: "invoices" | "payments";
  periodo: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

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
        toast.info(
          kind === "invoices"
            ? "No se generó nada nuevo (ya estaban creados o falta cargar servicios mensuales)."
            : "No se generó nada nuevo (ya estaban creados o falta cargar la compensación de cada persona).",
          { duration: 6000 }
        );
      } else {
        toast.success(
          `${created} ${kind === "invoices" ? "cobro(s)" : "pago(s)"} generado(s) para ${periodLabel(periodo)}.`
        );
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={generate} disabled={pending} className="gap-1.5">
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
