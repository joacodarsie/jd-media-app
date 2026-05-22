"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleClientStatus } from "@/app/(app)/clientes/actions";

export function ClientStatusToggle({
  id,
  currentStatus,
  fechaActivado,
  fechaInactivado,
}: {
  id: string;
  currentStatus: string;
  fechaActivado: string | null;
  fechaInactivado: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isActive = currentStatus === "activo";

  function flip() {
    const msg = isActive
      ? "¿Marcar como inactivo? Se va a registrar la fecha de hoy."
      : "¿Reactivar este cliente?";
    if (!confirm(msg)) return;
    start(async () => {
      const res = await toggleClientStatus(id, currentStatus);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isActive ? "Cliente marcado inactivo" : "Cliente reactivado");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Estado</div>
          <div className="font-semibold">
            {isActive ? "Activo" : "Inactivo"}
          </div>
        </div>
        <Button
          size="sm"
          variant={isActive ? "outline" : "default"}
          onClick={flip}
          disabled={pending}
          className="gap-1"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Power className="h-3.5 w-3.5" />
          )}
          {isActive ? "Marcar inactivo" : "Reactivar"}
        </Button>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {fechaActivado && (
          <div>
            Activado:{" "}
            <b className="text-foreground">
              {new Date(fechaActivado).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </b>
          </div>
        )}
        {fechaInactivado && !isActive && (
          <div>
            Inactivado:{" "}
            <b className="text-foreground">
              {new Date(fechaInactivado).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </b>
          </div>
        )}
      </div>
    </div>
  );
}
