"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hoyYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Un color por persona: con el calendario del equipo (pedido de Luz, 12/10/2026)
 * lo primero que se busca es "qué tiene cada uno", no la prioridad.
 */
const COLORES = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
  "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-200",
];
const SIN_ASIGNAR = "bg-muted text-muted-foreground";

const primerNombre = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "Sin asignar";

type Modo = "mes" | "semana";

export function TaskCalendar({ tasks }: { tasks: TaskWithRels[] }) {
  const [cursor, setCursor] = useState(new Date());
  const [modo, setModo] = useState<Modo>("mes");
  const [abierto, setAbierto] = useState<string | null>(null);
  const hoy = hoyYmd();

  // Color estable por persona: se reparte en orden alfabético.
  const colorDe = useMemo(() => {
    const ids = Array.from(
      new Map(
        tasks.filter((t) => t.asignado).map((t) => [t.asignado!.id, t.asignado!.nombre])
      )
    ).sort((a, b) => a[1].localeCompare(b[1]));
    const m = new Map(ids.map(([id], i) => [id, COLORES[i % COLORES.length]]));
    return (id?: string | null) => (id && m.get(id)) || SIN_ASIGNAR;
  }, [tasks]);

  const byDay = useMemo(() => {
    const m = new Map<string, TaskWithRels[]>();
    for (const t of tasks) {
      if (!t.fecha_limite) continue;
      const k = t.fecha_limite.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    // Lo pendiente arriba, lo terminado al final.
    for (const l of m.values())
      l.sort(
        (a, b) =>
          Number(a.estado === "completada") - Number(b.estado === "completada") ||
          primerNombre(a.asignado?.nombre).localeCompare(primerNombre(b.asignado?.nombre))
      );
    return m;
  }, [tasks]);

  const days = useMemo(() => {
    if (modo === "semana") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor, modo]);

  // Quién tiene cuánto en lo que se está viendo (sin contar lo terminado).
  const porPersona = useMemo(() => {
    const visibles = new Set(days.map((d) => format(d, "yyyy-MM-dd")));
    const m = new Map<string, { id: string | null; nombre: string; n: number }>();
    for (const t of tasks) {
      const k = t.fecha_limite?.slice(0, 10);
      if (!k || !visibles.has(k) || t.estado === "completada") continue;
      if (modo === "mes" && !isSameMonth(new Date(`${k}T12:00:00`), cursor)) continue;
      const id = t.asignado?.id ?? null;
      const key = id ?? "—";
      const e = m.get(key) ?? { id, nombre: primerNombre(t.asignado?.nombre), n: 0 };
      e.n++;
      m.set(key, e);
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  }, [tasks, days, modo, cursor]);

  const sinFecha = tasks.filter((t) => !t.fecha_limite && t.estado !== "completada").length;
  const mover = (n: number) =>
    setCursor((c) => (modo === "semana" ? addDays(c, 7 * n) : addMonths(c, n)));

  const titulo =
    modo === "semana"
      ? `Semana del ${format(days[0], "d 'de' LLLL", { locale: es })}`
      : format(cursor, "LLLL yyyy", { locale: es });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold first-letter:uppercase">{titulo}</h3>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-md border p-0.5">
            {(["mes", "semana"] as Modo[]).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "h-7 rounded-sm px-2.5 text-xs font-medium capitalize",
                  modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => mover(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => mover(1)} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {porPersona.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">
            Pendientes {modo === "semana" ? "esta semana" : "del mes"}:
          </span>
          {porPersona.map((p) => (
            <span
              key={p.id ?? "—"}
              className={cn("rounded-full px-2 py-0.5 font-medium", colorDe(p.id))}
            >
              {p.nombre} {p.n}
            </span>
          ))}
          {sinFecha > 0 && (
            <span className="text-muted-foreground">· {sinFecha} sin fecha (no figuran acá)</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <div
          className={cn(
            "grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm",
            "min-w-[640px]"
          )}
        >
          {DOW.map((d, i) => (
            <div
              key={d}
              className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {modo === "semana" ? `${d} ${format(days[i], "d")}` : d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = byDay.get(key) ?? [];
            const todas = modo === "semana" || abierto === key;
            const visibles = todas ? dayTasks : dayTasks.slice(0, 4);
            return (
              <div
                key={key}
                className={cn(
                  "bg-card p-1.5",
                  modo === "semana" ? "min-h-64" : "min-h-24",
                  modo === "mes" && !isSameMonth(day, cursor) && "bg-muted/40 text-muted-foreground"
                )}
              >
                {modo === "mes" && (
                  <div
                    className={cn(
                      "mb-1 text-right text-xs",
                      isToday(day) &&
                        "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                )}
                <div className="space-y-1">
                  {visibles.map((t) => {
                    const hecha = t.estado === "completada";
                    const vencida = !hecha && key < hoy;
                    return (
                      <Link
                        key={t.id}
                        href={`/tareas/${t.id}`}
                        className={cn(
                          "block rounded px-1.5 py-0.5 text-[11px] leading-tight",
                          colorDe(t.asignado?.id),
                          hecha && "line-through opacity-50",
                          vencida && "ring-1 ring-red-500"
                        )}
                        title={`${t.titulo} · ${t.asignado?.nombre ?? "Sin asignar"}${
                          t.cliente ? ` · ${t.cliente.nombre}` : ""
                        }${vencida ? " · VENCIDA" : ""}`}
                      >
                        <span className="font-semibold">{primerNombre(t.asignado?.nombre)}</span>{" "}
                        <span className={cn(modo === "mes" && "line-clamp-1")}>{t.titulo}</span>
                      </Link>
                    );
                  })}
                  {modo === "mes" && dayTasks.length > 4 && (
                    <button
                      onClick={() => setAbierto(todas ? null : key)}
                      className="px-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      {todas ? "Ver menos" : `+${dayTasks.length - 4} más`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cada tarea va en su fecha límite, con el color de quien la tiene. Borde rojo = vencida,
        tachada = terminada. Los filtros de arriba (persona, cliente, área) también aplican acá.
      </p>
    </div>
  );
}
