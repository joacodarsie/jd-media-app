"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { updateTaskStatus } from "@/app/(app)/tareas/actions";
import {
  STATUS_ORDER,
  STATUS_LABEL,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskWithRels } from "@/lib/types";

function Card({ task }: { task: TaskWithRels }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const due = dueState(task.fecha_limite, task.estado);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/tareas/${task.id}`)}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 text-left shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="text-sm font-medium">{task.titulo}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            PRIORITY_BADGE[task.prioridad]
          )}
        >
          {PRIORITY_LABEL[task.prioridad]}
        </span>
        {task.cliente && (
          <span className="text-muted-foreground">{task.cliente.nombre}</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{task.asignado?.nombre ?? "Sin asignar"}</span>
        <span
          className={cn(
            due === "vencida" && "font-semibold text-red-600",
            due === "hoy" && "font-semibold text-orange-600"
          )}
        >
          {task.fecha_limite ? fmtDate(task.fecha_limite) : ""}
        </span>
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: TaskWithRels[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/40"
        )}
      >
        {tasks.map((t) => (
          <Card key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks }: { tasks: TaskWithRels[] }) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [active, setActive] = useState<TaskWithRels | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  function onStart(e: DragStartEvent) {
    setActive(items.find((t) => t.id === e.active.id) ?? null);
  }

  function onEnd(e: DragEndEvent) {
    setActive(null);
    const overId = e.over?.id as TaskStatus | undefined;
    if (!overId) return;
    const id = e.active.id as string;
    const task = items.find((t) => t.id === id);
    if (!task || task.estado === overId) return;
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, estado: overId } : t))
    );
    updateTaskStatus(id, overId).then((res) => {
      if (res?.error) {
        toast.error("No se pudo mover: " + res.error);
        setItems(tasks);
      } else {
        toast.success(`Movida a "${STATUS_LABEL[overId]}"`);
        router.refresh();
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onStart}
      onDragEnd={onEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.filter((s) => s !== "archivada").map((s) => (
          <Column
            key={s}
            status={s}
            tasks={items.filter((t) => t.estado === s)}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-72 rotate-2">
            <Card task={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
