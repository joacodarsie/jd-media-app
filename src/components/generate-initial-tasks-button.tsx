"use client";

import { useTransition } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateInitialTasks } from "@/app/(app)/clientes/[id]/onboarding/actions";

export function GenerateInitialTasksButton({
  clientId,
  alreadyDone,
}: {
  clientId: string;
  alreadyDone: boolean;
}) {
  const [pending, start] = useTransition();

  function run() {
    const ok = window.confirm(
      alreadyDone
        ? "Ya se generaron tareas antes. ¿Generar otras nuevas en paralelo según los servicios actuales?"
        : "Se van a crear tareas automáticamente según los servicios contratados (auditoría, manual de marca, calendario, setup de paid media, etc.). ¿Continuar?"
    );
    if (!ok) return;
    start(async () => {
      const res = await generateInitialTasks(clientId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("count" in res) {
        toast.success(`Se crearon ${res.count} tareas iniciales.`);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <ListChecks className="mr-1 h-4 w-4" />
      )}
      {alreadyDone ? "Generar de nuevo" : "Generar tareas"}
    </Button>
  );
}
