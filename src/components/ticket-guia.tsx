"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleDot, Clock, Loader2, PencilLine } from "lucide-react";
import { aprobarTarea, pedirCambios, reasignarTarea } from "@/app/(app)/tareas/aprobacion-actions";
import type { Paso } from "@/lib/tareas/puerta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * "Qué te toca": arriba de cada ticket, lo que tiene que hacer quien lo abre.
 *
 * La plataforma sabe quién mira (el responsable, la PM que reparte, la
 * directora que aprueba) y le muestra solo sus pasos, con el que sigue
 * marcado. Si le toca actuar, el botón está acá mismo: aprobar, pedir cambios
 * o repartir, sin buscarlo en la ficha.
 */
export function TicketGuia({
  taskId,
  titulo,
  pasos,
  reloj,
  aprobar,
  repartir,
  usuarios,
  asignadoId,
}: {
  taskId: string;
  titulo: string;
  pasos: Paso[];
  /** El plazo de la aprobación, si el ticket está en revisión. */
  reloj: { texto: string; vencida: boolean; aprobadora: string | null } | null;
  /** true = quien mira puede aprobar o pedir cambios ahora. */
  aprobar: boolean;
  /** true = quien mira es la PM (o dirección) y el ticket está esperando reparto. */
  repartir: boolean;
  usuarios: { id: string; nombre: string }[];
  asignadoId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cambios, setCambios] = useState(false);
  const [detalle, setDetalle] = useState("");

  const correr = (fn: () => Promise<{ error?: string; ok?: boolean } | undefined>, exito: string) =>
    start(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(exito);
      setCambios(false);
      setDetalle("");
      router.refresh();
    });

  return (
    <section
      className={cn(
        "rounded-xl border-2 p-4",
        aprobar ? "border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20" : "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {reloj && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              reloj.vencida
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            )}
          >
            <Clock className="h-3 w-3" />
            {reloj.aprobadora ? `Aprobación de ${reloj.aprobadora.split(" ")[0]}: ` : "Aprobación: "}
            {reloj.texto}
          </span>
        )}
      </div>

      <ol className="mt-3 space-y-1.5">
        {pasos.map((p, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 text-sm",
              p.hecho && "text-muted-foreground line-through",
              p.actual && "font-medium"
            )}
          >
            {p.hecho ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : p.actual ? (
              <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            ) : (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[11px] text-muted-foreground">
                {i + 1}
              </span>
            )}
            <span>{p.texto}</span>
          </li>
        ))}
      </ol>

      {aprobar && (
        <div className="mt-4 space-y-2">
          {!cambios ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => correr(() => aprobarTarea(taskId), "Aprobado")}
                disabled={pending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Aprobar
              </Button>
              <Button variant="outline" onClick={() => setCambios(true)} disabled={pending}>
                <PencilLine className="mr-1.5 h-4 w-4" /> Pedir cambios
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                rows={3}
                autoFocus
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Qué hay que corregir, puntual: «subir el logo en la placa 2», «el texto del final es muy chico»…"
                className="bg-background"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => correr(() => pedirCambios(taskId, detalle), "Cambios pedidos")} disabled={pending}>
                  {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Mandar cambios
                </Button>
                <Button variant="ghost" onClick={() => setCambios(false)} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {repartir && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm">Asignar este ticket a</span>
          <Select
            value={asignadoId ?? undefined}
            onValueChange={(v) => correr(() => reasignarTarea(taskId, v), "Asignado")}
            disabled={pending}
          >
            <SelectTrigger className="h-9 w-56 bg-background">
              <SelectValue placeholder="Elegir persona" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">o repartí cada subtarea en el desglose.</span>
        </div>
      )}
    </section>
  );
}
