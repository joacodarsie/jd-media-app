"use client";

import { Ilustracion, type Escena } from "@/components/ilustracion";
import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  ListTree,
  Filter,
  Kanban,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Table as TableIcon,
  Trash2,
  X,
} from "lucide-react";
import {
  bulkUpdateTaskStatus,
  bulkDeleteTasks,
  bulkReassignTasks,
  bulkSetDueDate,
} from "@/app/(app)/tareas/actions";
import {
  AREAS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  PRIORITY_BADGE,
  STATUS_LABEL,
  STATUS_ORDER,
} from "@/lib/constants";
import { fmtDate, dueState, cuandoVence, hoyYmd } from "@/lib/dates";
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
import { esDe } from "@/lib/tareas/colaboradores";
import { TaskStatusSelect } from "@/components/task-status-select";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { CompletarTarea } from "@/components/completar-tarea";
import { TrabadaBoton } from "@/components/trabada-boton";
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
type QuickFilter =
  | "todas"
  | "mias"
  | "vencidas"
  | "vencidas_equipo"
  | "sin_fecha"
  | "hoy"
  | "semana";
type ViewMode = "lista" | "tabla" | "kanban" | "calendario";

const QUICK_LABELS: Record<QuickFilter, string> = {
  todas: "Todas",
  mias: "Mis tareas",
  vencidas: "Vencidas",
  // Solo para coordinación: las vencidas de TODO el equipo, para poder hacer la
  // limpieza en lote (cerrar, reasignar o archivar) sin entrar una por una.
  vencidas_equipo: "Vencidas del equipo",
  // Una tarea sin fecha límite no entra en el aviso diario: no está vencida ni
  // por vencer, así que no existe para nadie. Este chip es el único lugar donde
  // se la ve, para ponerle fecha o archivarla.
  sin_fecha: "Sin fecha",
  hoy: "Hoy",
  semana: "Esta semana",
};

import {
  agruparPorTicket,
  contarAgrupadas,
  type RefMadre,
} from "@/lib/tareas/agrupar";
import { formatTicket, progresoTicket } from "@/lib/tareas/tickets";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TaskViews({
  tasks,
  users,
  clients,
  currentUserId,
  esCoordinacion = false,
  madres = {},
  conHistorial = false,
}: {
  tasks: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  currentUserId: string;
  /** Coordinación/admin ve el chip "Vencidas del equipo" para hacer la limpieza. */
  esCoordinacion?: boolean;
  /** Tickets madre que no entraron en la lista, para nombrar las subtareas sueltas. */
  madres?: Record<string, RefMadre | undefined>;
  /** Si ya se cargó lo terminado (completadas y archivadas). */
  conHistorial?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("lista");
  const [quick, setQuick] = useState<QuickFilter>("mias");
  // Autofiltro por mes: arranca en el mes actual. null = todos los meses.
  // Solo aplica a las vistas "Mis tareas" y "Todas" (hoy/semana/vencidas ya
  // tienen su propio rango temporal).
  const [monthCursor, setMonthCursor] = useState<Date | null>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // El calendario navega sus propios meses: si el filtro de mes aplicara, al
  // pasar a noviembre se vería vacío.
  const monthApplies = (quick === "mias" || quick === "todas") && view !== "calendario";
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(ALL);
  // Lo terminado no viene de entrada: se pide al filtrar por ese estado.
  useEffect(() => {
    if (conHistorial || (estado !== "completada" && estado !== "archivada")) return;
    const u = new URLSearchParams(window.location.search);
    u.set("historial", "1");
    router.replace(`/tareas?${u}`, { scroll: false });
  }, [estado, conHistorial, router]);
  const [prioridad, setPrioridad] = useState(ALL);
  const [asignado, setAsignado] = useState(ALL);
  const [cliente, setCliente] = useState(ALL);
  const [area, setArea] = useState(ALL);
  const [orden, setOrden] = useState("limite");

  // Bulk selection (solo en vista lista)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Persistir vista preferida
  useEffect(() => {
    const v = localStorage.getItem("jd:tareas:view") as ViewMode | null;
    if (v === "lista" || v === "tabla" || v === "kanban" || v === "calendario") setView(v);
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
      // Por defecto mostramos solo lo que FALTA hacer: lo ya terminado
      // (completada/archivada) se oculta salvo que se filtre por ese estado.
      if (estado === ALL && (t.estado === "completada" || t.estado === "archivada"))
        return false;
      // Quick filter
      if (quick === "mias" && !esDe(t, currentUserId)) return false;
      if (quick === "vencidas" || quick === "vencidas_equipo") {
        if (t.estado === "completada") return false;
        if (!t.fecha_limite || t.fecha_limite.slice(0, 10) >= today) return false;
        // "Vencidas" son las tuyas; "del equipo" son las de todos (coordinación).
        if (quick === "vencidas" && !esDe(t, currentUserId)) return false;
      }
      if (quick === "sin_fecha" && t.fecha_limite) return false;
      if (quick === "hoy") {
        if (!t.fecha_limite || t.fecha_limite.slice(0, 10) !== today) return false;
      }
      if (quick === "semana") {
        if (!t.fecha_limite) return false;
        const d = t.fecha_limite.slice(0, 10);
        if (d < today || d > weekEndStr) return false;
      }
      // Autofiltro por mes (solo en "mias" / "todas"). Las tareas sin fecha
      // límite se muestran igual para no perderlas.
      if (monthApplies && monthCursor && t.fecha_limite) {
        const d = t.fecha_limite.slice(0, 7);
        const mk = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
        if (d !== mk) return false;
      }
      // Filtros avanzados
      if (q && !t.titulo.toLowerCase().includes(q.toLowerCase())) return false;
      if (estado !== ALL && t.estado !== estado) return false;
      if (prioridad !== ALL && t.prioridad !== prioridad) return false;
      if (asignado !== ALL && !esDe(t, asignado)) return false;
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
  }, [tasks, q, estado, prioridad, asignado, cliente, area, orden, quick, currentUserId, monthApplies, monthCursor]);

  // La lista se agrupa por ticket: las subtareas van adentro de su madre en vez
  // de sueltas al mismo nivel. Sin esto un onboarding de 15 días metía catorce
  // filas seguidas en el medio de las demás y nada decía que trece colgaban de
  // la primera.
  const agrupadas = useMemo(() => agruparPorTicket(filtered, madres), [filtered, madres]);
  const resumenGrupos = useMemo(() => contarAgrupadas(agrupadas), [agrupadas]);

  // Tickets a los que se le puede colgar una tarea nueva: los que YA tienen
  // desglose y siguen abiertos. No se ofrecen las 180 tareas sueltas — una
  // tarea se vuelve ticket agregándole la primera subtarea desde su ficha.
  const ticketsAbiertos = useMemo(() => {
    const conHijas = new Set(tasks.map((t) => t.parent_id).filter(Boolean) as string[]);
    return tasks
      .filter(
        (t) =>
          conHijas.has(t.id) &&
          t.estado !== "completada" &&
          t.estado !== "archivada"
      )
      .sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0))
      .map((t) => ({ id: t.id, numero: t.numero ?? null, titulo: t.titulo }));
  }, [tasks]);

  // Conteos para los chips
  const counts = useMemo(() => {
    const today = ymd(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = ymd(weekEnd);
    // Para "mias"/"todas" los conteos respetan el mes seleccionado (las sin
    // fecha se cuentan igual, como en la lista).
    const mk = monthCursor
      ? `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`
      : null;
    const inMonth = (t: TaskWithRels) =>
      !mk || !t.fecha_limite || t.fecha_limite.slice(0, 7) === mk;
    // Los chips cuentan trabajo ABIERTO (lo que falta), no lo ya terminado.
    const isOpen = (t: TaskWithRels) =>
      t.estado !== "completada" && t.estado !== "archivada";
    return {
      todas: tasks.filter((t) => inMonth(t) && isOpen(t)).length,
      mias: tasks.filter(
        (t) => esDe(t, currentUserId) && inMonth(t) && isOpen(t)
      ).length,
      vencidas: tasks.filter(
        (t) =>
          isOpen(t) &&
          t.fecha_limite &&
          t.fecha_limite.slice(0, 10) < today &&
          esDe(t, currentUserId)
      ).length,
      vencidasEquipo: tasks.filter(
        (t) => isOpen(t) && t.fecha_limite && t.fecha_limite.slice(0, 10) < today
      ).length,
      // Sin filtro de mes, a propósito: justamente no tienen mes.
      sinFecha: tasks.filter((t) => isOpen(t) && !t.fecha_limite).length,
      hoy: tasks.filter(
        (t) => isOpen(t) && t.fecha_limite && t.fecha_limite.slice(0, 10) === today
      ).length,
      semana: tasks.filter((t) => {
        if (!isOpen(t) || !t.fecha_limite) return false;
        const d = t.fecha_limite.slice(0, 10);
        return d >= today && d <= weekEndStr;
      }).length,
    };
  }, [tasks, currentUserId, monthCursor]);

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
            {/* Explica por qué la lista muestra menos filas que tareas: las
                subtareas están adentro de su ticket, no perdidas. */}
            {view === "lista" && resumenGrupos.subtareas > 0 && (
              <>
                {" · "}
                {resumenGrupos.subtareas} en el desglose de{" "}
                {resumenGrupos.tickets}{" "}
                {resumenGrupos.tickets === 1 ? "ticket" : "tickets"}
              </>
            )}
          </p>
        </div>
        <TaskFormDialog
          mode="create"
          users={users}
          clients={clients}
          tickets={ticketsAbiertos}
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
        {esCoordinacion && (
          <QuickChip
            icon={AlertCircle}
            label={QUICK_LABELS.vencidas_equipo}
            count={counts.vencidasEquipo}
            active={quick === "vencidas_equipo"}
            danger
            onClick={() => setQuick("vencidas_equipo")}
          />
        )}
        {esCoordinacion && counts.sinFecha > 0 && (
          <QuickChip
            icon={CalendarOff}
            label={QUICK_LABELS.sin_fecha}
            count={counts.sinFecha}
            active={quick === "sin_fecha"}
            danger
            onClick={() => setQuick("sin_fecha")}
          />
        )}
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

        {/* Selector de mes — solo aplica a Mis tareas / Todas */}
        {monthApplies && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() =>
                setMonthCursor((c) => {
                  const base = c ?? new Date();
                  return new Date(base.getFullYear(), base.getMonth() - 1, 1);
                })
              }
              className="rounded-md border bg-card p-1 text-muted-foreground hover:text-foreground"
              title="Mes anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setMonthCursor((c) =>
                  c ? null : new Date(d.getFullYear(), d.getMonth(), 1)
                );
              }}
              className={cn(
                "min-w-28 rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors",
                monthCursor
                  ? "bg-primary/10 text-foreground"
                  : "bg-card text-muted-foreground"
              )}
              title={monthCursor ? "Ver todos los meses" : "Volver al mes actual"}
            >
              {monthCursor
                ? monthCursor.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba",
                    month: "long",
                    year: "numeric",
                  })
                : "Todos los meses"}
            </button>
            <button
              onClick={() =>
                setMonthCursor((c) => {
                  const base = c ?? new Date();
                  return new Date(base.getFullYear(), base.getMonth() + 1, 1);
                })
              }
              className="rounded-md border bg-card p-1 text-muted-foreground hover:text-foreground"
              title="Mes siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
          <ViewBtn icon={TableIcon} label="Tabla" active={view === "tabla"} onClick={() => setView("tabla")} />
          <ViewBtn icon={Kanban} label="Kanban" active={view === "kanban"} onClick={() => setView("kanban")} />
          <ViewBtn icon={CalendarDays} label="Calendario" active={view === "calendario"} onClick={() => setView("calendario")} />
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
        <div className="space-y-6 pb-20">
          {filtered.length === 0 ? (
            <EmptyState filter={quick} />
          ) : (
            gruposPorFecha(agrupadas).map((g, _i, todos) => (
              // Lo de más adelante y lo sin fecha arranca cerrado: primero lo
              // urgente (24/10/2026, pedido del dueño: menos de una).
              <details
                key={g.clave}
                open={todos.length === 1 || (g.clave !== "ok" && g.clave !== "none")}
                className="group/grupo animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                <summary className="mb-1.5 flex cursor-pointer list-none items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className={cn("h-1.5 w-1.5 rounded-full", g.punto)} />
                  {g.titulo}
                  <span className="font-normal normal-case tracking-normal">· {g.items.length}</span>
                  <ChevronDown className="h-3 w-3 transition group-open/grupo:rotate-180" />
                  {g.clave === "vencida" && (
                    <Link
                      href="/tareas/limpieza"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto font-medium normal-case tracking-normal text-primary hover:underline"
                    >
                      🧹 Limpiar las mías →
                    </Link>
                  )}
                </summary>
                <div className="jd-cascada divide-y divide-border/60 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50">
            {g.items.map((f) =>
              f.tipo === "ticket" ? (
                <TicketGroup
                  key={f.tarea.id}
                  ticket={f.tarea}
                  subtareas={f.subtareas}
                  users={users}
                  clients={clients}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <TaskRow
                  key={f.tarea.id}
                  task={f.tarea}
                  madre={f.madre}
                  users={users}
                  clients={clients}
                  selected={selectedIds.has(f.tarea.id)}
                  onToggleSelect={() => toggleSelect(f.tarea.id)}
                />
              )
            )}
                </div>
              </details>
            ))
          )}
        </div>
      )}
      {view === "tabla" && (
        <div className="pb-20">
          {filtered.length === 0 ? (
            <EmptyState filter={quick} />
          ) : (
            <TaskTable
              tasks={filtered}
              users={users}
              clients={clients}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>
      )}
      {view === "kanban" && <KanbanBoard tasks={filtered} />}
      {view === "calendario" && <TaskCalendar tasks={filtered} />}

      {(view === "lista" || view === "tabla") && selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          pending={bulkPending}
          users={users}
          onClear={clearSelection}
          onChangeStatus={(estado) =>
            startBulk(async () => {
              const ids = Array.from(selectedIds);
              const res = await bulkUpdateTaskStatus(ids, estado);
              if (res?.error) toast.error(res.error);
              else {
                toast.success(`${res.count} tareas actualizadas`);
                clearSelection();
                router.refresh();
              }
            })
          }
          onReassign={(uid) =>
            startBulk(async () => {
              const ids = Array.from(selectedIds);
              const res = await bulkReassignTasks(ids, uid);
              if (res?.error) toast.error(res.error);
              else {
                toast.success(`${res.count} tareas reasignadas`);
                clearSelection();
                router.refresh();
              }
            })
          }
          onSetDueDate={(fecha) =>
            startBulk(async () => {
              const ids = Array.from(selectedIds);
              const res = await bulkSetDueDate(ids, fecha);
              if (res?.error) toast.error(res.error);
              else {
                toast.success(`${res.count} tareas con fecha ${fecha}`);
                clearSelection();
                router.refresh();
              }
            })
          }
          onDelete={() => {
            if (
              !confirm(
                `¿Eliminar ${selectedIds.size} tareas? Esta acción no se puede deshacer.`
              )
            )
              return;
            startBulk(async () => {
              const ids = Array.from(selectedIds);
              const res = await bulkDeleteTasks(ids);
              if (res?.error) toast.error(res.error);
              else {
                toast.success(`${res.count} tareas eliminadas`);
                clearSelection();
                router.refresh();
              }
            });
          }}
        />
      )}
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

function BulkActionsBar({
  count,
  pending,
  users,
  onClear,
  onChangeStatus,
  onReassign,
  onSetDueDate,
  onDelete,
}: {
  count: number;
  pending: boolean;
  users: Pick<AppUser, "id" | "nombre">[];
  onClear: () => void;
  onChangeStatus: (estado: string) => void;
  onReassign: (uid: string) => void;
  onSetDueDate: (fecha: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-5">
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-xl ring-1 ring-primary/10">
        <button
          onClick={onClear}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Deseleccionar"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">
          {count} seleccionada{count !== 1 && "s"}
        </span>
        {pending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select onValueChange={onChangeStatus} disabled={pending}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Cambiar estado…" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={onReassign} disabled={pending}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Reasignar a…" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Poner fecha a varias de una: es la salida del triage de "Sin
              fecha", donde entrar de a una no es viable. */}
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <input
              type="date"
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) onSetDueDate(e.target.value);
              }}
              className="h-8 rounded-md border bg-background px-2 text-xs"
              title="Poner esta fecha límite a todas las seleccionadas"
            />
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={pending}
            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Eliminar todas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: QuickFilter }) {
  const content: Record<
    QuickFilter,
    { title: string; description: string; emoji: string; escena?: Escena }
  > = {
    mias: {
      title: "No tenés tareas asignadas",
      description:
        "Cuando alguien te asigne una tarea va a aparecer acá. Mientras tanto podés crear una propia.",
      emoji: "✨",
    },
    vencidas: {
      title: "Sin tareas vencidas",
      description: "Perfecto, vas al día. Seguí así.",
      emoji: "🎉",
      escena: "listo",
    },
    vencidas_equipo: {
      title: "El equipo está al día",
      description: "Ninguna tarea vencida en toda la agencia.",
      emoji: "🎉",
      escena: "equipo",
    },
    sin_fecha: {
      title: "Todas las tareas tienen fecha",
      description:
        "Una tarea sin fecha no aparece en los avisos y termina olvidada. Acá no quedó ninguna.",
      emoji: "📅",
    },
    hoy: {
      title: "Nada vence hoy",
      description: "Aprovechá para adelantar pendientes de la semana.",
      emoji: "☀️",
      escena: "calendario",
    },
    semana: {
      title: "Sin tareas para esta semana",
      description: "Buen momento para planificar lo del mes que viene.",
      emoji: "📅",
    },
    todas: {
      title: "No hay tareas",
      description: "Creá la primera con el botón “Nueva tarea” arriba.",
      emoji: "📋",
    },
  };
  const c = content[filter];
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted/30 px-6 py-12 text-center animate-in fade-in zoom-in-95 duration-300">
      {c.escena ? <Ilustracion escena={c.escena} /> : <div className="jd-flota text-4xl">{c.emoji}</div>}
      <h3 className="text-sm font-semibold tracking-tight">{c.title}</h3>
      <p className="max-w-sm text-xs text-muted-foreground">{c.description}</p>
    </div>
  );
}

/**
 * Agrupa la lista por cuándo vence (17/10/2026): vencidas, hoy, esta semana,
 * más adelante y sin fecha. Se lee de un vistazo sin pintar cada fila.
 */
function gruposPorFecha<F extends { tarea: { fecha_limite?: string | null; estado?: string } }>(filas: F[]) {
  const defs = [
    { clave: "vencida", titulo: "Vencidas", punto: "bg-rose-500" },
    { clave: "hoy", titulo: "Hoy", punto: "bg-amber-500" },
    { clave: "pronto", titulo: "Próximos días", punto: "bg-sky-500" },
    { clave: "ok", titulo: "Más adelante", punto: "bg-muted-foreground/40" },
    { clave: "none", titulo: "Sin fecha o terminadas", punto: "bg-muted-foreground/20" },
  ] as const;
  const grupos = defs.map((d) => ({ ...d, items: [] as F[] }));
  for (const f of filas) {
    const estado = dueState(f.tarea.fecha_limite, f.tarea.estado);
    grupos.find((g) => g.clave === estado)!.items.push(f);
  }
  return grupos.filter((g) => g.items.length > 0);
}

function TaskRow({
  task: t,
  users,
  clients,
  selected,
  onToggleSelect,
  madre = null,
  anidada = false,
}: {
  task: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  selected: boolean;
  onToggleSelect: () => void;
  /** Ticket al que pertenece, cuando la madre no está en la lista. */
  madre?: RefMadre | null;
  /** Va adentro del desglose de un ticket: se dibuja más chica y con sangría. */
  anidada?: boolean;
}) {
  const due = dueState(t.fecha_limite, t.estado);
  const abierta = t.estado !== "completada" && t.estado !== "archivada";
  const trabada = !!t.bloqueo;
  // Rediseño (19/10/2026): en el celular la fila es el círculo de «hecha», el
  // título completo y una línea con la fecha en palabras; lo demás (estado,
  // editar, borrar, seleccionar) vive en la compu o adentro de la tarea.
  return (
    <div
      data-fila-tarea
      className={cn(
        "group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:items-center sm:py-2.5",
        selected && "bg-primary/5 hover:bg-primary/10",
        anidada && "rounded-lg border-l-2 border-l-muted py-2 pl-3 pr-1"
      )}
    >
      <label
        className="hidden shrink-0 cursor-pointer items-center sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleccionar ${t.titulo}`}
          className="h-4 w-4 cursor-pointer rounded border-muted-foreground/40 accent-primary"
        />
      </label>
      {abierta ? <CompletarTarea id={t.id} titulo={t.titulo} /> : <span className="h-5 w-5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <Link
          href={`/tareas/${t.id}`}
          className={cn("line-clamp-2 font-medium leading-snug hover:underline sm:line-clamp-1", anidada && "text-sm")}
        >
          {t.titulo}
        </Link>
        {/* Subtarea cuya madre quedó fuera del filtro: se dice de dónde sale. */}
        {madre && (
          <Link
            href={`/tareas/${madre.id}`}
            className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span className="font-mono">{formatTicket(madre.numero)}</span>
            <span className="truncate">{madre.titulo}</span>
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {t.fecha_limite && abierta && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                due === "vencida" && "text-rose-600 dark:text-rose-400",
                due === "hoy" && "text-amber-600 dark:text-amber-400"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  due === "vencida" ? "bg-rose-500" : due === "hoy" ? "bg-amber-500" : due === "pronto" ? "bg-sky-500" : "bg-muted-foreground/30"
                )}
                aria-hidden="true"
              />
              {cuandoVence(t.fecha_limite, hoyYmd())}
            </span>
          )}
          {/* Solo se marca lo urgente: la prioridad media es la de siempre. */}
          {(t.prioridad === "alta" || t.prioridad === "urgente") && (
            <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", PRIORITY_BADGE[t.prioridad])}>
              {PRIORITY_LABEL[t.prioridad]}
            </span>
          )}
          {t.cliente && <span className="truncate font-medium text-foreground/70">{t.cliente.nombre}</span>}
          <span>
            {t.asignado?.nombre?.split(" ")[0] ?? "Sin asignar"}
            <MasPersonas t={t} />
          </span>
          <span className="hidden sm:inline">· {t.area}</span>
          {formatTicket(t.numero) && <span className="hidden font-mono text-[10px] opacity-70 sm:inline">{formatTicket(t.numero)}</span>}
        </div>
      </div>
      {abierta && (due === "vencida" || trabada) && (
        <span className={cn("shrink-0 self-center", !trabada && "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100")}>
          <TrabadaBoton taskId={t.id} titulo={t.titulo} bloqueo={t.bloqueo} bloqueoQuien={t.bloqueo_quien} />
        </span>
      )}
      <div className="hidden items-center gap-1 transition-opacity sm:flex sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
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

/**
 * Un ticket madre con su desglose adentro, como el backlog de Jira.
 *
 * Arranca PLEGADO a propósito: el ticket es una línea con su avance, y el
 * desglose se abre cuando lo querés ver. Desplegado por defecto, un onboarding
 * de 15 días vuelve a tapar la lista, que es justo lo que se vino a arreglar.
 */
function TicketGroup({
  ticket,
  subtareas,
  users,
  clients,
  selectedIds,
  onToggleSelect,
}: {
  ticket: TaskWithRels;
  subtareas: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const prog = progresoTicket(subtareas);
  const pct = Math.round(prog.pct * 100);

  return (
    <div>
      <TaskRow
        task={ticket}
        users={users}
        clients={clients}
        selected={selectedIds.has(ticket.id)}
        onToggleSelect={() => onToggleSelect(ticket.id)}
      />
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
      >
        {abierto ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <ListTree className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground">
          {prog.hechas} de {prog.total}
        </span>
        <span>subtareas listas</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="tabular-nums">{pct}%</span>
        </span>
      </button>
      {abierto && (
        <div className="space-y-1 border-t bg-muted/20 p-2 pl-5">
          {subtareas.map((s) => (
            <TaskRow
              key={s.id}
              task={s}
              anidada
              users={users}
              clients={clients}
              selected={selectedIds.has(s.id)}
              onToggleSelect={() => onToggleSelect(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Vista TABLA (planilla, mismo estilo que la tabla del calendario)
// ─────────────────────────────────────────────────────────────────────────
function TaskTable({
  tasks,
  users,
  clients,
  selectedIds,
  onToggleSelect,
}: {
  tasks: TaskWithRels[];
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5 font-medium">Tarea</th>
            <th className="px-3 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Área</th>
            <th className="px-3 py-2.5 font-medium">Persona</th>
            <th className="px-3 py-2.5 font-medium">Prioridad</th>
            <th className="px-3 py-2.5 font-medium">Vence</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <TaskTableRow
              key={t.id}
              task={t}
              users={users}
              clients={clients}
              selected={selectedIds.has(t.id)}
              onToggleSelect={() => onToggleSelect(t.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTableRow({
  task: t,
  users,
  clients,
  selected,
  onToggleSelect,
}: {
  task: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const due = dueState(t.fecha_limite, t.estado);
  return (
    <tr
      className={cn(
        "border-b align-top last:border-0 hover:bg-muted/30",
        selected && "bg-primary/5"
      )}
    >
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleccionar ${t.titulo}`}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </td>
      <td className="px-3 py-2.5">
        <Link href={`/tareas/${t.id}`} className="font-medium hover:underline">
          {t.titulo}
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {t.cliente?.nombre ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.area}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
        {t.asignado?.nombre ?? "Sin asignar"}
        <MasPersonas t={t} />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_BADGE[t.prioridad])}>
          {PRIORITY_LABEL[t.prioridad]}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {t.fecha_limite ? (
          <span
            className={cn(
              "text-xs",
              due === "vencida" && "font-semibold text-red-600",
              due === "hoy" && "font-semibold text-orange-600"
            )}
          >
            {fmtDate(t.fecha_limite)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <TaskStatusSelect id={t.id} estado={t.estado} className="h-8 w-36 text-xs" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
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
      </td>
    </tr>
  );
}

/** «+2» al lado del responsable cuando hay colaboradores (0199). */
function MasPersonas({ t }: { t: TaskWithRels }) {
  const n = (t.colaboradores ?? []).length;
  if (!n) return null;
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-foreground" title={`Y ${n} ${n === 1 ? "persona más" : "personas más"}`}>
      +{n}
    </span>
  );
}
