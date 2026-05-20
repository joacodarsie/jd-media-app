"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/lib/constants";
import { dueState } from "@/lib/dates";
import type { AppUser, TaskWithRels } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskList } from "@/components/task-list";

const ALL = "__all__";

export function AreaDashboard({
  tasks,
  users,
  areas,
  defaultArea,
}: {
  tasks: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  areas: string[];
  defaultArea: string;
}) {
  const [area, setArea] = useState(defaultArea);
  const [estado, setEstado] = useState(ALL);
  const [prioridad, setPrioridad] = useState(ALL);
  const [persona, setPersona] = useState(ALL);

  const ofArea = useMemo(
    () => tasks.filter((t) => t.area === area),
    [tasks, area]
  );

  const filtered = useMemo(
    () =>
      ofArea.filter((t) => {
        if (estado !== ALL && t.estado !== estado) return false;
        if (prioridad !== ALL && t.prioridad !== prioridad) return false;
        if (persona !== ALL && t.asignado_a_id !== persona) return false;
        return true;
      }),
    [ofArea, estado, prioridad, persona]
  );

  const activas = ofArea.filter((t) => t.estado !== "completada");
  const vencidas = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Por área</h1>
          <p className="text-muted-foreground">
            Qué está pasando en cada área del equipo.
          </p>
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Activas" value={activas.length} />
        <Stat
          label="Completadas"
          value={ofArea.filter((t) => t.estado === "completada").length}
        />
        <Stat label="Vencidas" value={vencidas} danger={vencidas > 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Filter
          value={estado}
          onChange={setEstado}
          label="Estado"
          options={Object.entries(STATUS_LABEL)}
        />
        <Filter
          value={prioridad}
          onChange={setPrioridad}
          label="Prioridad"
          options={Object.entries(PRIORITY_LABEL)}
        />
        <Filter
          value={persona}
          onChange={setPersona}
          label="Persona"
          options={users.map((u) => [u.id, u.nombre])}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay tareas en esta área con esos filtros.
        </p>
      ) : (
        <TaskList tasks={filtered} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-3xl font-bold ${danger ? "text-red-600" : ""}`}>
          {value}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function Filter({
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
