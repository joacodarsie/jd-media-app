"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toggleSeguirTarea } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";

/**
 * Seguir un ticket que no es tuyo.
 *
 * Del pedido del 13/9 ("Jira te buchonea"): hoy solo se entera quien tiene la
 * tarea asignada, así que la coordinación se entera de los cambios cuando
 * pregunta. Esto es para el tercero — típicamente la Project Manager o la
 * Dirección Creativa sobre una pieza que no es suya.
 *
 * No aparece si ya sos el responsable: a vos te llegan los avisos igual y un
 * botón que no cambia nada solo confunde.
 */
export function SeguirTareaButton({
  taskId,
  siguiendoInicial,
}: {
  taskId: string;
  siguiendoInicial: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [siguiendo, setSiguiendo] = useState(siguiendoInicial);
  const [guardando, setGuardando] = useState(false);

  async function toggle() {
    const nuevo = !siguiendo;
    setSiguiendo(nuevo);
    setGuardando(true);
    const res = await toggleSeguirTarea(taskId, nuevo);
    setGuardando(false);
    if (res?.error) {
      setSiguiendo(!nuevo);
      toast.error(res.error);
      return;
    }
    toast.success(
      nuevo
        ? "Te avisamos cuando cambie algo de este ticket."
        : "Dejaste de seguir el ticket."
    );
    startTransition(() => router.refresh());
  }

  return (
    <Button
      variant={siguiendo ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={guardando}
      className="gap-1.5"
      title={
        siguiendo
          ? "Te llegan los cambios de este ticket"
          : "Enterarte cuando cambie algo de este ticket"
      }
    >
      {guardando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : siguiendo ? (
        <Bell className="h-3.5 w-3.5" />
      ) : (
        <BellOff className="h-3.5 w-3.5" />
      )}
      {siguiendo ? "Siguiendo" : "Seguir"}
    </Button>
  );
}
