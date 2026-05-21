"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  markInvoicePaid,
  markInvoiceUnpaid,
  markPaymentPaid,
  markPaymentUnpaid,
  markExpensePaid,
  markExpenseUnpaid,
} from "@/app/(app)/finanzas/actions";

interface Props {
  id: string;
  kind: "invoice" | "payment" | "expense";
  paidAt: string | null;
}

export function MarkPaidButton({ id, kind, paidAt }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("");

  function confirmPaid() {
    start(async () => {
      const res =
        kind === "invoice"
          ? await markInvoicePaid(id, fecha, metodo || null)
          : kind === "payment"
            ? await markPaymentPaid(id, fecha, metodo || null)
            : await markExpensePaid(id, fecha, metodo || null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "invoice" ? "Marcada como cobrada" : "Marcada como pagada");
      setOpen(false);
      router.refresh();
    });
  }

  function undo() {
    if (!confirm("¿Marcar como pendiente de nuevo?")) return;
    start(async () => {
      const res =
        kind === "invoice"
          ? await markInvoiceUnpaid(id)
          : kind === "payment"
            ? await markPaymentUnpaid(id)
            : await markExpenseUnpaid(id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Vuelve a pendiente");
      router.refresh();
    });
  }

  if (paidAt) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={undo}
        disabled={pending}
        className="h-7 gap-1 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
        title="Marcar como pendiente"
      >
        <Check className="h-3.5 w-3.5" />
        <span className="text-xs">
          {new Date(paidAt).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="mr-1 h-3.5 w-3.5" />
              {kind === "invoice" ? "Marcar cobrada" : "Marcar pagada"}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 p-3">
        <div>
          <Label htmlFor={`fecha-${id}`} className="text-xs">
            Fecha {kind === "invoice" ? "de cobro" : "de pago"}
          </Label>
          <Input
            id={`fecha-${id}`}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`metodo-${id}`} className="text-xs">
            Método (opcional)
          </Label>
          <Input
            id={`metodo-${id}`}
            placeholder="Transferencia, efectivo, MP…"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={confirmPaid} disabled={pending}>
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
