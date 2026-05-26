"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskStatus } from "@/app/(app)/tareas/actions";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskStatusSelect({
  id,
  estado,
  className,
}: {
  id: string;
  estado: TaskStatus;
  className?: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  // Optimistic state: actualizamos la UI antes del round-trip al server.
  // Si falla, revertimos al valor previo y mostramos error.
  const [current, setCurrent] = useState<TaskStatus>(estado);

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const previous = current;
        const next = v as TaskStatus;
        if (next === previous) return;
        setCurrent(next);
        start(async () => {
          const res = await updateTaskStatus(id, next);
          if (res?.error) {
            setCurrent(previous);
            toast.error("Error: " + res.error);
          } else {
            toast.success("Estado actualizado");
            router.refresh();
          }
        });
      }}
    >
      <SelectTrigger className={className} onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
