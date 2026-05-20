"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTask } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";

export function DeleteTaskButton({
  id,
  redirectTo,
}: {
  id: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title="Eliminar tarea"
      onClick={(e) => {
        e.stopPropagation();
        if (!confirm("¿Eliminar esta tarea? No se puede deshacer.")) return;
        start(async () => {
          const res = await deleteTask(id);
          if (res?.error) {
            toast.error("No se pudo eliminar: " + res.error);
            return;
          }
          toast.success("Tarea eliminada");
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
