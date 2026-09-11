"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PauseCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarEnPausa, toggleParaRecuperar } from "@/app/(app)/clientes/actions";

/**
 * Las dos situaciones que antes se escondían adentro de "perdido".
 *
 * Reemplaza al viejo botón "Todavía no pagó", que estaba acá arriba al lado de
 * Editar: mezclaba en Clientes a los que no habían pagado con los clientes de
 * verdad. Quien firmó y nunca pagó es una propuesta; quien debe el mes se ve en
 * Cobros. Lo que sí hacía falta distinguir es otra cosa: quién frenó y va a
 * volver, y de los que se fueron, a quién vale la pena ir a buscar.
 */
export function PonerEnPausaButton({
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
      title="Frenó pero no se fue. Deja de contar en Finanzas y en Sueldos mientras esté en pausa."
      onClick={() => {
        if (
          !confirm(
            `¿Poner a ${nombre} en pausa? Deja de contar en Finanzas y en Sueldos, pero no se cuenta como una baja.`
          )
        )
          return;
        start(async () => {
          const res = await marcarEnPausa(clienteId);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success(`${nombre} quedó en pausa`);
          router.refresh();
        });
      }}
    >
      <PauseCircle className="mr-2 h-4 w-4" /> Poner en pausa
    </Button>
  );
}

export function ParaRecuperarButton({
  clienteId,
  nombre,
  inicial,
}: {
  clienteId: string;
  nombre: string;
  inicial: boolean;
}) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(inicial);
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      title={
        marcado
          ? "Sacarlo de la lista de cuentas a recuperar"
          : "Se fue, pero hay chances reales de volver a trabajar con ellos"
      }
      className={
        marcado
          ? "border-sky-400 text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
          : undefined
      }
      onClick={() =>
        start(async () => {
          const res = await toggleParaRecuperar(clienteId, !marcado);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          setMarcado(!marcado);
          toast.success(
            marcado ? `${nombre} ya no figura para recuperar` : `${nombre} queda para recuperar`
          );
          router.refresh();
        })
      }
    >
      <Undo2 className="mr-2 h-4 w-4" />
      {marcado ? "Ya no la busco" : "Para recuperar"}
    </Button>
  );
}
