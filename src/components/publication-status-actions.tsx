"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { changePublicationStatus } from "@/app/(app)/contenidos/actions";
import {
  PUBLICATION_STATUS_LABEL,
  nextPublicationStatuses,
} from "@/lib/constants";
import type { Publication } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function PublicationStatusActions({
  publication,
}: {
  publication: Pick<Publication, "id" | "estado" | "tipo">;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const options = nextPublicationStatuses(publication.estado, publication.tipo);

  if (options.length === 0) return null;

  function move(target: string) {
    const needsNote = target === "rechazado";
    const finalNote = needsNote ? notes : undefined;
    if (needsNote && !notes.trim()) {
      toast.error("Dejá una nota explicando los cambios.");
      return;
    }
    start(async () => {
      const res = await changePublicationStatus(publication.id, target, finalNote);
      if (res?.error) {
        toast.error("No se pudo cambiar: " + res.error);
        return;
      }
      toast.success("Estado: " + PUBLICATION_STATUS_LABEL[target as never]);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === "rechazado" ? "outline" : "default"}
            onClick={() => move(s)}
            disabled={pending}
          >
            <ArrowRight className="mr-1 h-3 w-3" />
            {PUBLICATION_STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      {options.includes("rechazado") && (
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas para pedir cambios (obligatorio si rechazás)"
          className="w-full rounded-md border bg-background p-2 text-sm"
        />
      )}
    </div>
  );
}
