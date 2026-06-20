"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateClient } from "@/app/(app)/clientes/actions";

/**
 * Botón para activar un cliente que está en estado "Propuesta": se usa cuando el
 * cliente pagó. Lo pasa a Activo, arranca su primer mes (Finanzas + comisión de
 * cierre) y marca el lead como ganado.
 */
export function ClientActivateButton({
  id,
  nombre,
  size = "default",
}: {
  id: string;
  nombre: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function activate() {
    if (
      !confirm(
        `¿Activar a "${nombre}"?\n\nUsalo cuando el cliente ya te transfirió. Se va a:\n- Pasar la ficha de Propuesta a Activo\n- Arrancar su primer mes (empieza a contar en Finanzas)\n- Cargar sola la comisión de cierre del comercial que lo cerró`
      )
    )
      return;
    start(async () => {
      const res = await activateClient(id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente activado. Ya cuenta como cliente real.");
      router.refresh();
    });
  }

  return (
    <Button
      size={size}
      onClick={activate}
      disabled={pending}
      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      Activar cliente (pagó)
    </Button>
  );
}
