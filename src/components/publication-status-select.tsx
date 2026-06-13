"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { changePublicationStatus } from "@/app/(app)/contenidos/actions";
import {
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_BADGE,
  PUBLICATION_STATUS_DOT,
} from "@/lib/constants";
import type { PublicationStatus, Publication } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL_STATUSES: PublicationStatus[] = [
  "idea",
  "en_diseno",
  "edicion",
  "revision_creativa",
  "revision_cliente",
  "aprobado",
  "publicado",
  "rechazado",
];

export function PublicationStatusSelect({
  publication,
  className,
  size = "sm",
}: {
  publication: Pick<Publication, "id" | "estado">;
  className?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingNote, setPendingNote] = useState<PublicationStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Estado local optimista: refleja el estado mostrado en el SelectTrigger
  // sin esperar a que el padre rerenderice tras router.refresh().
  const [localEstado, setLocalEstado] = useState<PublicationStatus>(
    publication.estado
  );

  // Si el padre rerendea con un estado nuevo (por router.refresh o cambio externo),
  // sincronizamos el local.
  useEffect(() => {
    setLocalEstado(publication.estado);
  }, [publication.estado]);

  function apply(target: PublicationStatus, finalNote?: string) {
    setInlineError(null);
    start(async () => {
      try {
        const res = await changePublicationStatus(
          publication.id,
          target,
          finalNote
        );
        if (res?.error) {
          const msg = "No se pudo cambiar: " + res.error;
          setInlineError(msg);
          toast.error(msg);
          return;
        }
        // Actualización optimista local: el trigger ya quedó OK en DB,
        // reflejamos visualmente al instante.
        setLocalEstado(target);
        toast.success("Estado: " + PUBLICATION_STATUS_LABEL[target]);
        setPendingNote(null);
        setNotes("");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        setInlineError(msg);
        toast.error(msg);
      }
    });
  }

  function onChange(target: string) {
    const t = target as PublicationStatus;
    if (t === localEstado) return;
    if (t === "rechazado") {
      setPendingNote(t);
      setInlineError(null);
      return;
    }
    apply(t);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        // El key forzamos que Radix re-monte cuando el estado local cambia,
        // así el trigger refleja siempre el último valor aplicado.
        key={localEstado}
        value={localEstado}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger
          className={cn(
            "w-full font-medium",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
            PUBLICATION_STATUS_BADGE[localEstado]
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                    PUBLICATION_STATUS_DOT[s]
                  )}
                />
                {PUBLICATION_STATUS_LABEL[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pendingNote === "rechazado" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs font-medium">
            Pediste cambios. Dejá una nota explicando qué hay que ajustar:
          </p>
          <textarea
            rows={2}
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: cambiar el copy del primer slide, color del fondo más oscuro…"
            className="w-full rounded-md border bg-background p-2 text-xs"
            disabled={pending}
          />
          {inlineError && (
            <p className="rounded bg-red-100 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {inlineError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingNote(null);
                setNotes("");
                setInlineError(null);
              }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!notes.trim()) {
                  toast.error("Dejá una nota.");
                  return;
                }
                apply("rechazado", notes);
              }}
              disabled={pending || !notes.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
