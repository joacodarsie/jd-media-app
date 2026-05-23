"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { assignUserSecondaryPositions } from "@/app/(app)/equipo/actions";
import type { Position } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function SecondaryPositionsEditor({
  userId,
  userName,
  primaryId,
  current,
  positions,
}: {
  userId: string;
  userName: string;
  primaryId: string | null;
  current: string[];
  positions: Pick<Position, "id" | "nombre">[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(current);

  const currentMap = new Map(positions.map((p) => [p.id, p.nombre]));
  const eligible = positions.filter((p) => p.id !== primaryId);

  function toggle(id: string) {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  }

  function quickRemove(id: string) {
    start(async () => {
      const next = current.filter((x) => x !== id);
      const res = await assignUserSecondaryPositions(userId, next);
      if (res?.error) {
        toast.error("No se pudo quitar: " + res.error);
        return;
      }
      router.refresh();
    });
  }

  function save() {
    start(async () => {
      const res = await assignUserSecondaryPositions(userId, selected);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Puestos secundarios actualizados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {current.map((id) => {
        const name = currentMap.get(id);
        if (!name) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]"
          >
            {name}
            <button
              type="button"
              onClick={() => quickRemove(id)}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground"
              title="Quitar"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setSelected(current);
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground"
          >
            <Pencil className="mr-1 h-3 w-3" />
            {current.length === 0 ? "Agregar secundario" : "Editar"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Puestos secundarios — {userName}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Marcá todos los puestos que esta persona también cubre además del
            principal. Útil para gente que ayuda en más de un área.
          </p>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay otros puestos disponibles.
              </p>
            ) : (
              eligible.map((p) => {
                const active = selected.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={active}
                      onChange={() => toggle(p.id)}
                    />
                    <span>{p.nombre}</span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
