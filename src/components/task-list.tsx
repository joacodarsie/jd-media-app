import Link from "next/link";
import type { TaskWithRels } from "@/lib/types";
import {
  STATUS_LABEL,
  STATUS_BADGE,
  PRIORITY_LABEL,
  PRIORITY_BADGE,
} from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const DUE_CLASS: Record<string, string> = {
  vencida: "text-red-600 font-semibold",
  hoy: "text-orange-600 font-semibold",
  pronto: "text-amber-600",
  ok: "text-muted-foreground",
  none: "text-muted-foreground",
};

export function TaskList({
  tasks,
}: {
  tasks: TaskWithRels[];
  currentUserId?: string;
}) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const due = dueState(t.fecha_limite, t.estado);
        return (
          <Card key={t.id} className="p-0">
            <Link
              href={`/tareas/${t.id}`}
              className="flex flex-col gap-2 p-4 hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{t.titulo}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      STATUS_BADGE[t.estado]
                    )}
                  >
                    {STATUS_LABEL[t.estado]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      PRIORITY_BADGE[t.prioridad]
                    )}
                  >
                    {PRIORITY_LABEL[t.prioridad]}
                  </span>
                  {t.cliente && (
                    <span className="text-muted-foreground">
                      {t.cliente.nombre}
                    </span>
                  )}
                  <span className="text-muted-foreground">· {t.area}</span>
                </div>
              </div>
              <div className={cn("shrink-0 text-sm", DUE_CLASS[due])}>
                {t.fecha_limite
                  ? `Vence ${fmtDate(t.fecha_limite)}`
                  : "Sin fecha"}
              </div>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
