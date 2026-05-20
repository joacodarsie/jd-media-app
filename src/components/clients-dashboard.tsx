"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { CLIENT_STATUS_LABEL } from "@/lib/constants";
import { dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Client, TaskWithRels } from "@/lib/types";
import { TaskList } from "@/components/task-list";

interface ClientRow extends Client {
  creativa?: { id: string; nombre: string } | null;
}

const ESTADO_BADGE: Record<string, string> = {
  activo:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function ClientsDashboard({
  clients,
  tasks,
}: {
  clients: ClientRow[];
  tasks: TaskWithRels[];
}) {
  const byClient = useMemo(() => {
    const m = new Map<string, TaskWithRels[]>();
    for (const t of tasks) {
      if (!t.cliente_id) continue;
      if (!m.has(t.cliente_id)) m.set(t.cliente_id, []);
      m.get(t.cliente_id)!.push(t);
    }
    return m;
  }, [tasks]);

  const internas = tasks.filter((t) => !t.cliente_id);

  return (
    <div className="space-y-3">
      {clients.map((c) => (
        <ClientCard key={c.id} client={c} tasks={byClient.get(c.id) ?? []} />
      ))}
      {internas.length > 0 && (
        <Group title="Tareas internas (sin cliente)" tasks={internas} />
      )}
    </div>
  );
}

function ClientCard({
  client,
  tasks,
}: {
  client: ClientRow;
  tasks: TaskWithRels[];
}) {
  const activas = tasks.filter((t) => t.estado !== "completada");
  const vencidas = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  ).length;

  return (
    <details className="group rounded-lg border bg-card transition-colors hover:border-primary/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clientes/${client.id}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {client.nombre}
            </Link>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                ESTADO_BADGE[client.estado]
              )}
            >
              {CLIENT_STATUS_LABEL[client.estado]}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {client.pack} · {client.creativa?.nombre ?? "Sin responsable"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {client.calendario_url && (
            <a
              href={client.calendario_url}
              target="_blank"
              rel="noreferrer"
              title="Calendario de contenidos"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CalendarDays className="h-4 w-4" />
            </a>
          )}
          {client.drive_url && (
            <a
              href={client.drive_url}
              target="_blank"
              rel="noreferrer"
              title="Drive del cliente"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FolderOpen className="h-4 w-4" />
            </a>
          )}
          <span title="Activas">{activas.length} activas</span>
          {vencidas > 0 && (
            <span className="font-semibold text-red-600">
              {vencidas} vencidas
            </span>
          )}
          <Link
            href={`/clientes/${client.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            title="Abrir cliente"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t p-4">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin tareas.</p>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>
    </details>
  );
}

function Group({ title, tasks }: { title: string; tasks: TaskWithRels[] }) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {tasks.length}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t p-4">
        <TaskList tasks={tasks} />
      </div>
    </details>
  );
}
