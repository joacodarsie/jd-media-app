"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  FolderOpen,
  Search,
} from "lucide-react";
import { CLIENT_PACK_LABEL, CLIENT_STATUS_LABEL } from "@/lib/constants";
import { dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Client, TaskWithRels } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { TaskList } from "@/components/task-list";

interface ClientRow extends Client {
  creativa?: { id: string; nombre: string } | null;
}

type Quick = "activos" | "perdido" | "todos";
const QUICK_LABEL: Record<Quick, string> = {
  activos: "Activos",
  perdido: "Perdidos",
  todos: "Todos",
};

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
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<Quick>("activos");
  const [pack, setPack] = useState<string>("__all__");
  const [resp, setResp] = useState<string>("__all__");

  useEffect(() => {
    const v = localStorage.getItem("jd:clientes:quick") as Quick | null;
    if (v && QUICK_LABEL[v]) setQuick(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("jd:clientes:quick", quick);
  }, [quick]);

  const byClient = useMemo(() => {
    const m = new Map<string, TaskWithRels[]>();
    for (const t of tasks) {
      if (!t.cliente_id) continue;
      if (!m.has(t.cliente_id)) m.set(t.cliente_id, []);
      m.get(t.cliente_id)!.push(t);
    }
    return m;
  }, [tasks]);

  const responsables = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) {
      if (c.creativa) m.set(c.creativa.id, c.creativa.nombre);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (quick === "activos" && c.estado !== "activo") return false;
      if (quick === "perdido" && c.estado !== "perdido") return false;
      if (pack !== "__all__" && c.pack !== pack) return false;
      if (resp !== "__all__" && c.creativa_asignada_id !== resp) return false;
      if (q && !c.nombre.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [clients, quick, pack, resp, q]);

  const counts = useMemo(
    () => ({
      activos: clients.filter((c) => c.estado === "activo").length,
      perdido: clients.filter((c) => c.estado === "perdido").length,
      todos: clients.length,
    }),
    [clients]
  );

  const internas = tasks.filter((t) => !t.cliente_id);
  const showInternas = quick === "activos" || quick === "todos";

  return (
    <div className="space-y-3">
      {/* Quick chips por estado */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(QUICK_LABEL) as Quick[]).map((k) => (
          <button
            key={k}
            onClick={() => setQuick(k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              quick === k
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {QUICK_LABEL[k]}
            <span className="text-[10px] opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="__all__">Todos los packs</option>
          {Object.entries(CLIENT_PACK_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="__all__">Cualquier responsable</option>
          {responsables.map(([id, n]) => (
            <option key={id} value={id}>{n}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No hay clientes con esos filtros.
          </div>
        ) : (
          filtered.map((c) => (
            <ClientCard key={c.id} client={c} tasks={byClient.get(c.id) ?? []} />
          ))
        )}
        {showInternas && internas.length > 0 && (
          <Group title="Tareas internas (sin cliente)" tasks={internas} />
        )}
      </div>
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
