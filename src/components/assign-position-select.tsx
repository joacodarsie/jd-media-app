"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignUserPosition } from "@/app/(app)/equipo/actions";
import type { Position } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function AssignPositionSelect({
  userId,
  current,
  positions,
}: {
  userId: string;
  current: string | null;
  positions: Pick<Position, "id" | "nombre">[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(v: string) {
    start(async () => {
      const res = await assignUserPosition(userId, v === NONE ? null : v);
      if (res?.error) {
        toast.error("No se pudo asignar: " + res.error);
        return;
      }
      toast.success("Puesto actualizado");
      router.refresh();
    });
  }

  return (
    <Select value={current ?? NONE} onValueChange={change} disabled={pending}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin puesto</SelectItem>
        {positions.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
