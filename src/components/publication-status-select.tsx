"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changePublicationStatus } from "@/app/(app)/contenidos/actions";
import {
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_BADGE,
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
  "guion",
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

  function apply(target: PublicationStatus, finalNote?: string) {
    start(async () => {
      const res = await changePublicationStatus(
        publication.id,
        target,
        finalNote
      );
      if (res?.error) {
        toast.error("No se pudo cambiar: " + res.error);
        return;
      }
      toast.success("Estado: " + PUBLICATION_STATUS_LABEL[target]);
      setPendingNote(null);
      setNotes("");
      router.refresh();
    });
  }

  function onChange(target: string) {
    const t = target as PublicationStatus;
    if (t === publication.estado) return;
    if (t === "rechazado") {
      setPendingNote(t);
      return;
    }
    apply(t);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={publication.estado}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger
          className={cn(
            "w-full font-medium",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
            PUBLICATION_STATUS_BADGE[publication.estado]
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
                    "inline-block h-2 w-2 rounded-full",
                    PUBLICATION_STATUS_BADGE[s]
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
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingNote(null);
                setNotes("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
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
              disabled={pending}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
