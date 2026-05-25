"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Filter,
  Kanban,
  List,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  AREAS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  PRIORITY_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { HelpTrigger } from "@/components/help-trigger";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { TaskStatusSelect } from "@/components/task-status-select";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { SkeletonBlock } from "@/components/skeleton-block";

// Lazy-load heavy views — solo se cargan al hacer click en la tab
const KanbanBoard = dynamic(
  () => import("@/components/kanban-board").then((m) => m.KanbanBoard),
  { ssr: false, loading: () => <SkeletonBlock className="h-96 w-full" /> }
);
const TaskCalendar = dynamic(
  () => import("@/components/task-calendar").then((m) => m.TaskCalendar),
  { ssr: false, loading: () => <SkeletonBlock className="h-96 w-full" /> }
);

const ALL = "__all__";
type QuickFilter = "todas" | "mias" | "vencidas" | "hoy" | "semana";
type ViewMode = "lista" | "kanban" | "calendario";

const QUICK_LABELS: Record<QuickFilter, string> = {
  todas: "Todas",
  mias: "Mis tareas",
  vencidas: "Vencidas",
  hoy: "Hoy",
  semana: "Esta semana",
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TaskViews({
  tasks,
  users,
  clients,
  currentUserId,
}: {
  tasks: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  currentUserId: string;
}) {
  const [view, setView] = useState<ViewMode>("lista");
  const [quick, setQuick] = useState<QuickFilter>("mias");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(ALL);
  const [prioridad, setPrioridad] = useState(ALL);
  const [asignado, setAsignado] = useState(ALL);
  const [cliente, setCliente] = useState(ALL);
  const [area, setArea] = useState(ALL);
  const [orden, setOrden] = useState("limite");

  // Persistir vista preferida
  useEffect(() => {
    const v = localStorage.getItem("jd:tareas:view") as ViewMode | null;
    if (v === "lista" || v === "kanban" || v === "calendario") setView(v);
    const f = localStorage.getItem("jd:tareas:quick") as QuickFilter | null;
    if (f && QUICK_LABELS[f]) setQuick(f);
  }, []);
  useEffect(() => {
    localStorage.setItem("jd:tareas:view", view);
  }, [view]);
  useEffect(() => {
    localStorage.setItem("jd:tareas:quick", quick);
  }, [quick]);

  const filtered = useMemo(() => {
    const today = ymd(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = ymd(weekEnd);

    let r = tasks.filter((t) => {
      // Quick filter
      if (quick === "mias" && t.asignado_a_id !== currentUserId) return false;
      if (quick === "vencidas") {
        if (t.estado === "completada") return false;
        if (!t.fecha_limite || t.fecha_limite.slice(0, 10) >= today) return false;
      }
      if (quick === "hoy") {
        if (!t.fecha_limite || t.fecha_limite.slice(0, 10) !== today) return false;
      }
      if (quick === "semana") {
        if (!t.fecha_limite) return false;
        const d = t.fecha_limite.slice(0, 10);
        if (d < today || d > weekEndStr) return false;
      }
      // Filtros avanzados
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
      if (!a.fecha_limite) return 1;
      if (!b.fecha_limite) return -1;
      return a.fecha_limite.localeCompare(b.fecha_limite);
    });
    return r;
  }, [tasks, q, estado, prioridad, asignado, cliente, area, orden, quick, currentUserId]);

  // Conteos para los chips
  const counts = useMemo(() => {
    const today = ymd(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = ymd(weekEnd);
    return {
      todas: tasks.length,
      mias: tasks.filter((t) => t.asignado_a_id === currentUserId).length,
      vencidas: tasks.filter(
        (t) =>
          t.estado !== "completada" &&
          t.fecha_limite &&
          t.fecha_limite.slice(0, 10) < today
      ).length,
      hoy: tasks.filter(
        (t) => t.fecha_limite && t.fecha_limite.slice(0, 10) === today
      ).length,
      semana: tasks.filter((t) => {
        if (!t.fecha_limite) return false;
        const d = t.fecha_limite.slice(0, 10);
        return d >= today && d <= weekEndStr;
      }).length,
    };
  }, [tasks, currentUserId]);

  const activeAdv = [estado, prioridad, asignado, cliente, area].filter(
    (v) => v !== ALL
  ).length;

  function clearAdv() {
    setEstado(ALL);
    setPrioridad(ALL);
    setAsignado(ALL);
    setCliente(ALL);
    setArea(ALL);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Tareas
            <HelpTrigger
              slug="tareas"
              label="Cómo usar Tareas"
              size="md"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "tarea" : "tareas"} ·{" "}
            {QUICK_LABELS[quick]}
            {activeAdv > 0 && ` · ${activeAdv} filtro${activeAdv > 1 ? "s" : ""}`}
          </p>
        </div>
        <TaskFormDialog
          mode="create"
          users={users}
          clients={clients}
          trigger={
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva
            </Button>
          }
        />
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <QuickChip
          icon={Sparkles}
          label={QUICK_LABELS.mias}
          count={counts.mias}
          active={quick === "mias"}
          onClick={() => setQuick("mias")}
        />
        <QuickChip
          icon={AlertCircle}
          label={QUICK_LABELS.vencidas}
          count={counts.vencidas}
          active={quick === "vencidas"}
          danger
          onClick={() => setQuick("vencidas")}
        />
        <QuickChip
          icon={CalendarDays}
          label={QUICK_LABELS.hoy}
          count={counts.hoy}
          active={quick === "hoy"}
          onClick={() => setQuick("hoy")}
        />
        <QuickChip
          icon={CalendarDays}
          label={QUICK_LABELS.semana}
          count={counts.semana}
          active={quick === "semana"}
          onClick={() => setQuick("semana")}
        />
        <QuickChip
          label={QUICK_LABELS.todas}
          count={counts.todas}
          active={quick === "todas"}
          onClick={() => setQuick("todas")}
        />
      </div>

      {/* Búsqueda + filtros avanzados + vista */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filtros
              {activeAdv > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {activeAdv}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3" align="end">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Filtros avanzados</h4>
              {activeAdv > 0 && (
                <button
                  onClick={clearAdv}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
            <FilterRow label="Estado" value={estado} onChange={setEstado} options={Object.entries(STATUS_LABEL)} />
            <FilterRow label="Prioridad" value={prioridad} onChange={setPrioridad} options={Object.entries(PRIORITY_LABEL)} />
            <FilterRow label="Persona" value={asignado} onChange={setAsignado} options={users.map((u) => [u.id, u.nombre])} />
            <FilterRow label="Cliente" value={cliente} onChange={setCliente} options={clients.map((c) => [c.id, c.nombre])} />
            <FilterRow label="Área" value={area} onChange={setArea} options={AREAS.map((a) => [a, a])} />
            <div className="border-t pt-2">
              <Label className="text-xs">Ordenar por</Label>
              <Select value={orden} onValueChange={setOrden}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="limite">Fecha límite</SelectItem>
                  <SelectItem value="prioridad">Prioridad</SelectItem>
                  <SelectItem value="recientes">Más recientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        {/* View switch */}
        <div className="flex items-center rounded-md border bg-card p-0.5">
          <ViewBtn icon={List} label="Lista" active={view === "lista"} onClick={() => setView("lista")} />
          <ViewBtn icon={Kanban} label="Kanban" active={view === "kanban"} onClick={() => setView("kanban")} />
          <ViewBtn icon={CalendarDays} label="Cal" active={view === "calendario"} onClick={() => setView("calendario")} />
        </div>
      </div>

      {/* Active advanced filter chips */}
      {activeAdv > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {estado !== ALL && (
            <ActiveChip label={`Estado: ${STATUS_LABEL[estado as keyof typeof STATUS_LABEL]}`} onRemove={() => setEstado(ALL)} />
          )}
          {prioridad !== ALL && (
            <ActiveChip label={`Prioridad: ${PRIORITY_LABEL[prioridad as keyof typeof PRIORITY_LABEL]}`} onRemove={() => setPrioridad(ALL)} />
          )}
          {asignado !== ALL && (
            <ActiveChip label={`Persona: ${users.find((u) => u.id === asignado)?.nombre ?? ""}`} onRemove={() => setAsignado(ALL)} />
          )}
          {cliente !== ALL && (
            <ActiveChip label={`Cliente: ${clients.find((c) => c.id === cliente)?.nombre ?? ""}`} onRemove={() => setCliente(ALL)} />
          )}
          {area !== ALL && <ActiveChip label={`Área: ${area}`} onRemove={() => setArea(ALL)} />}
        </div>
      )}

      {/* Content */}
      {view === "lista" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState filter={quick} />
          ) : (
            filtered.map((t) => (
              <TaskRow key={t.id} task={t} users={users} clients={clients} />
            ))
          )}
        </div>
      )}
      {view === "kanban" && <KanbanBoard tasks={filtered} />}
      {view === "calendario" && <TaskCalendar tasks={filtered} />}
    </div>
  );
}

function QuickChip({
  icon: Icon,
  label,
  count,
  active,
  danger,
  onClick,
}: {
  icon?: typeof Sparkles;
  label: string;
  count: number;
  active: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? danger
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            : "border-primary bg-primary/10 text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <span className={cn("ml-0.5 text-[10px] tabular-nums", active ? "opacity-80" : "opacity-60")}>
        {count}
      </span>
    </button>
  );
}

function ViewBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof List;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px]">
      {label}
      <button onClick={onRemove} className="hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ filter }: { filter: QuickFilter }) {
  const msg: Record<QuickFilter, string> = {
    mias: "No tenés tareas asignadas con estos filtros.",
    vencidas: "Sin tareas vencidas. 🎉",
    hoy: "Nada vence hoy.",
    semana: "No hay tareas para esta semana.",
    todas: "No hay tareas que coincidan.",
  };
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {msg[filter]}
    </div>
  );
}

function TaskRow({
  task: t,
  users,
  clients,
}: {
  task: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
}) {
  const due = dueState(t.fecha_limite, t.estado);
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Link href={`/tareas/${t.id}`} className="font-medium hover:underline">
          {t.titulo}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", PRIORITY_BADGE[t.prioridad])}>
            {PRIORITY_LABEL[t.prioridad]}
          </span>
          <span>{t.asignado?.nombre ?? "Sin asignar"}</span>
          {t.cliente && <span>· {t.cliente.nombre}</span>}
          <span>· {t.area}</span>
          {t.fecha_limite && (
            <span
              className={cn(
                due === "vencida" && "font-semibold text-red-600",
                due === "hoy" && "font-semibold text-orange-600"
              )}
            >
              · {due === "vencida" ? "Vencida " : "Vence "}
              {fmtDate(t.fecha_limite)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <TaskStatusSelect id={t.id} estado={t.estado} className="h-8 w-36 text-xs" />
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
}
