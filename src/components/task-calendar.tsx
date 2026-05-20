"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
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
import { PRIORITY_BADGE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function TaskCalendar({ tasks }: { tasks: TaskWithRels[] }) {
  const [cursor, setCursor] = useState(new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, TaskWithRels[]>();
    for (const t of tasks) {
      if (!t.fecha_limite) continue;
      const k = t.fecha_limite.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">
          {format(cursor, "LLLL yyyy", { locale: es })}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        {DOW.map((d) => (
          <div
            key={d}
            className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 bg-card p-1.5",
                !isSameMonth(day, cursor) && "bg-muted/40 text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-xs",
                  isToday(day) &&
                    "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tareas/${t.id}`}
                    className={cn(
                      "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                      PRIORITY_BADGE[t.prioridad]
                    )}
                    title={t.titulo}
                  >
                    {t.titulo}
                  </Link>
                ))}
                {dayTasks.length > 4 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayTasks.length - 4} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
