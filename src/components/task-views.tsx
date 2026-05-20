"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Search } from "lucide-react";
import {
  AREAS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  PRIORITY_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AppUser, Client, TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { TaskStatusSelect } from "@/components/task-status-select";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskCalendar } from "@/components/task-calendar";

const ALL = "__all__";

export function TaskViews({
  tasks,
  users,
  clients,
}: {
  tasks: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
}) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(ALL);
  const [prioridad, setPrioridad] = useState(ALL);
  const [asignado, setAsignado] = useState(ALL);
  const [cliente, setCliente] = useState(ALL);
  const [area, setArea] = useState(ALL);
  const [orden, setOrden] = useState("limite");

  const filtered = useMemo(() => {
    let r = tasks.filter((t) => {
      if (q && !t.titulo.toLowerCase().includes(q.toLowerCase())) return false;
      if (estado !== ALL && t.estado !== estado) return false;
      if (prioridad !== ALL && t.prioridad !== prioridad) return false;
      if (asignado !== ALL && t.asignado_a_id !== asignado) return false;
      if (cliente !== ALL && t.cliente_id !== cliente) return false;
      if (area !== ALL && t.area !== area) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      if (orden === "prioridad")
        return PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad];
      if (orden === "recientes")
        return b.created_at.localeCompare(a.created_at);
      // límite (nulls al final)
      if (!a.fecha_limite) return 1;
      if (!b.fecha_limite) return -1;
      return a.fecha_limite.localeCompare(b.fecha_limite);
    });
    return r;
  }, [tasks, q, estado, prioridad, asignado, cliente, area, orden]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Tareas</h1>
        <TaskFormDialog
          mode="create"
          users={users}
          clients={clients}
          trigger={
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva tarea
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-44 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <FilterSelect
          value={estado}
          onChange={setEstado}
          label="Estado"
          options={Object.entries(STATUS_LABEL)}
        />
        <FilterSelect
          value={prioridad}
          onChange={setPrioridad}
          label="Prioridad"
          options={Object.entries(PRIORITY_LABEL)}
        />
        <FilterSelect
          value={asignado}
          onChange={setAsignado}
          label="Persona"
          options={users.map((u) => [u.id, u.nombre])}
        />
        <FilterSelect
          value={cliente}
          onChange={setCliente}
          label="Cliente"
          options={clients.map((c) => [c.id, c.nombre])}
        />
        <FilterSelect
          value={area}
          onChange={setArea}
          label="Área"
          options={AREAS.map((a) => [a, a])}
        />
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} tarea(s)
            </p>
            <Select value={orden} onValueChange={setOrden}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="limite">Por fecha límite</SelectItem>
                <SelectItem value="prioridad">Por prioridad</SelectItem>
                <SelectItem value="recientes">Más recientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay tareas con esos filtros.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const due = dueState(t.fecha_limite, t.estado);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tareas/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.titulo}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-medium",
                            PRIORITY_BADGE[t.prioridad]
                          )}
                        >
                          {PRIORITY_LABEL[t.prioridad]}
                        </span>
                        <span>{t.asignado?.nombre ?? "Sin asignar"}</span>
                        {t.cliente && <span>· {t.cliente.nombre}</span>}
                        <span>· {t.area}</span>
                        <span
                          className={cn(
                            due === "vencida" && "font-semibold text-red-600",
                            due === "hoy" && "font-semibold text-orange-600"
                          )}
                        >
                          {t.fecha_limite
                            ? `· Vence ${fmtDate(t.fecha_limite)}`
                            : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TaskStatusSelect
                        id={t.id}
                        estado={t.estado}
                        className="h-8 w-36 text-xs"
                      />
                      <TaskFormDialog
                        mode="edit"
                        task={t}
                        users={users}
                        clients={clients}
                        trigger={
                          <Button variant="ghost" size="icon" title="Editar">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        }
                      />
                      <DeleteTaskButton id={t.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban">
          <KanbanBoard tasks={filtered} />
        </TabsContent>

        <TabsContent value="calendario">
          <TaskCalendar tasks={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-32">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
