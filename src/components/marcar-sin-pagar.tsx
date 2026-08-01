"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarEsperandoPago } from "@/app/(app)/clientes/actions";

/**
 * Baja una cuenta a "esperando pago" desde SU ficha.
 *
 * Vivía en la lista de clientes, al lado del badge de cada fila, y ensuciaba la
 * vista: 15 botones "¿no pagó?" para un caso que pasa una vez por mes. Acá está
 * donde corresponde — dentro de la cuenta — y la lista queda limpia.
 */
export function MarcarSinPagarButton({
  clienteId,
  nombre,
}: {
  clienteId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      title="Todavía no pagó: lo saca del conteo de clientes y de la facturación hasta que marques el cobro"
      className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
      onClick={() => {
        if (
          !confirm(
            `¿${nombre} todavía no pagó? Deja de contar como cliente hasta que marques el cobro en "¿Quién me pagó?".`
          )
        )
          return;
        start(async () => {
          const res = await marcarEsperandoPago(clienteId);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success(`${nombre} pasó a "Esperando pago"`);
          router.refresh();
        });
      }}
    >
      <Hourglass className="mr-2 h-4 w-4" /> Todavía no pagó
    </Button>
  );
}
