import { formatTicket } from "@/lib/tareas/tickets";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { TaskWithRels } from "@/lib/types";
import { STATUS_LABEL, PRIORITY_LABEL, PRIORITY_BADGE } from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Lista corta de tareas (Mi día, ficha del cliente, panel de cuentas).
 *
 * Más tranquila (18/10/2026, pedido del dueño): filas sin caja dentro de una
 * sola tarjeta, el vencimiento como un punto de color en vez de texto rojo,
 * la prioridad solo cuando es alta y el estado solo cuando no es «pendiente».
 * Entran con una animación corta, una detrás de otra.
 */
const PUNTO: Record<string, string> = {
  vencida: "bg-rose-500",
  hoy: "bg-amber-500",
  pronto: "bg-sky-500",
  ok: "bg-muted-foreground/30",
  none: "bg-muted-foreground/20",
};

const TEXTO_FECHA: Record<string, string> = {
  vencida: "text-rose-600/90",
  hoy: "text-amber-600 font-medium",
  pronto: "text-foreground/70",
  ok: "text-muted-foreground",
  none: "text-muted-foreground",
};

export function TaskList({
  tasks,
}: {
  tasks: TaskWithRels[];
  currentUserId?: string;
}) {
  if (!tasks.length) return null;
  return (
    <div className="jd-cascada divide-y divide-border/60 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50">
      {tasks.map((t, i) => {
        const due = dueState(t.fecha_limite, t.estado);
        return (
          <Link
            key={t.id}
            href={`/tareas/${t.id}`}
            className="group flex items-center gap-3 px-4 py-3 transition-colors animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 hover:bg-muted/40"
            style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", PUNTO[due])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2">
                {formatTicket(t.numero) && (
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatTicket(t.numero)}</span>
                )}
                <span className="truncate font-medium">{t.titulo}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {t.estado !== "pendiente" && <span className="font-medium text-foreground/70">{STATUS_LABEL[t.estado]}</span>}
                {(t.prioridad === "alta" || t.prioridad === "urgente") && (
                  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", PRIORITY_BADGE[t.prioridad])}>
                    {PRIORITY_LABEL[t.prioridad]}
                  </span>
                )}
                {t.cliente && <span>{t.cliente.nombre}</span>}
                <span>· {t.area}</span>
              </div>
            </div>
            <span className={cn("shrink-0 text-xs tabular-nums", TEXTO_FECHA[due])}>
              {t.fecha_limite ? (due === "vencida" ? "Venció " : "") + fmtDate(t.fecha_limite) : "Sin fecha"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        );
      })}
    </div>
  );
}
