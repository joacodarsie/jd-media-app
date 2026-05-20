"use client";

import { useTransition } from "react";
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
  const [pending, start] = useTransition();

  return (
    <Select
      value={estado}
      disabled={pending}
      onValueChange={(v) =>
        start(async () => {
          const res = await updateTaskStatus(id, v);
          if (res?.error) toast.error("Error: " + res.error);
          else {
            toast.success("Estado actualizado");
            router.refresh();
          }
        })
      }
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
