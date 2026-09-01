"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOTIVOS, type MotivoPedido } from "@/lib/tareas/pedidos";
import { reportarProblema } from "@/app/(app)/tareas/pedidos-actions";

/**
 * "Reportar un problema" en una tarea.
 *
 * Lo puede tocar cualquiera del equipo, a propósito: el que sufre una tarea
 * que no le corresponde es justo el que no tiene permiso para reasignarla.
 * Antes eso se decía por WhatsApp y se perdía; ahora le llega a coordinación
 * con la tarea enganchada.
 */
export function TaskProblemButton({
  taskId,
  yaReportado,
}: {
  taskId: string;
  yaReportado?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoPedido>("no_me_corresponde");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const r = await reportarProblema(taskId, motivo, detalle);
    setEnviando(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(
      "avisados" in r && (r.avisados ?? 0) > 0
        ? "Listo, le avisamos a coordinación."
        : "Reportado. Coordinación lo va a ver.",
    );
    setAbierto(false);
    setDetalle("");
    startTransition(() => router.refresh());
  }

  if (yaReportado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <AlertCircle className="h-3.5 w-3.5" /> Reportada — coordinación lo está viendo
      </span>
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" title="Reportar un problema" onClick={() => setAbierto(true)}>
        <AlertCircle className="h-4 w-4" />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Reportar un problema
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Contanos qué pasa y le llega a coordinación. La tarea no se borra: alguien
              la mira y decide.
            </p>

            <div className="space-y-1.5">
              {MOTIVOS.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                    motivo === m.value ? "border-primary bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="motivo"
                    checked={motivo === m.value}
                    onChange={() => setMotivo(m.value)}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>

            <Textarea
              rows={3}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Detalle (opcional pero ayuda: qué pasó, qué haría falta)"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button onClick={enviar} disabled={enviando}>
                {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
