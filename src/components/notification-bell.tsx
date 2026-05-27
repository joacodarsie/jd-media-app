"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  UserPlus,
  AtSign,
  MessageCircle,
  Clock,
  AlertCircle,
  Check,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import { markRead, markAllRead } from "@/app/(app)/notificaciones/actions";
import { updateTaskStatus } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS: Record<string, LucideIcon> = {
  asignacion: UserPlus,
  mencion: AtSign,
  comentario: MessageCircle,
  proxima_a_vencer: Clock,
  vencida: AlertCircle,
};

const ICON_COLOR: Record<string, string> = {
  asignacion: "text-blue-500",
  mencion: "text-primary",
  comentario: "text-zinc-500",
  proxima_a_vencer: "text-amber-500",
  vencida: "text-red-500",
};

export function NotificationBell({
  items,
  unreadCount,
}: {
  items: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  // Tracking optimistico de las leidas. El servidor revalida al final,
  // pero la UI no espera el round-trip para tachar el item.
  const [optReadIds, setOptReadIds] = useState<Set<string>>(new Set());
  const [optAllRead, setOptAllRead] = useState(false);

  function isRead(n: Notification) {
    return n.leida || optReadIds.has(n.id) || optAllRead;
  }
  const displayUnreadCount = optAllRead
    ? 0
    : Math.max(0, unreadCount - optReadIds.size);

  function onClickItem(n: Notification) {
    if (!isRead(n)) {
      setOptReadIds((s) => new Set(s).add(n.id));
    }
    start(async () => {
      if (!n.leida) await markRead(n.id);
      setOpen(false);
      if (n.task_id) router.push(`/tareas/${n.task_id}`);
      router.refresh();
    });
  }

  function onMarkAll() {
    setOptAllRead(true);
    start(async () => {
      await markAllRead();
      router.refresh();
    });
  }

  // Quick action: marcar la tarea como completada SIN abrirla. Tambien marca
  // la notif como leida en el camino.
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(
    new Set()
  );
  function onCompleteTask(n: Notification) {
    if (!n.task_id) return;
    const tid = n.task_id;
    setOptReadIds((s) => new Set(s).add(n.id));
    setCompletedTaskIds((s) => new Set(s).add(tid));
    start(async () => {
      const res = await updateTaskStatus(tid, "completada");
      if (res?.error) {
        // Revertir si fallo
        setCompletedTaskIds((s) => {
          const next = new Set(s);
          next.delete(tid);
          return next;
        });
        toast.error("No se pudo completar: " + res.error);
      } else {
        toast.success("Tarea completada");
        if (!n.leida) await markRead(n.id);
        router.refresh();
      }
    });
  }
  function onMarkReadOnly(n: Notification) {
    if (n.leida || optReadIds.has(n.id)) return;
    setOptReadIds((s) => new Set(s).add(n.id));
    start(async () => {
      await markRead(n.id);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {displayUnreadCount > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {displayUnreadCount > 0 && (
            <button
              onClick={onMarkAll}
              className="text-xs text-primary hover:underline"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tenés notificaciones.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = ICONS[n.tipo] ?? Bell;
                const read = isRead(n);
                const completed = n.task_id
                  ? completedTaskIds.has(n.task_id)
                  : false;
                const showCompleteBtn =
                  !!n.task_id &&
                  !completed &&
                  (n.tipo === "asignacion" ||
                    n.tipo === "proxima_a_vencer" ||
                    n.tipo === "vencida");
                return (
                  <li key={n.id} className="group relative">
                    <button
                      onClick={() => onClickItem(n)}
                      className={cn(
                        "flex w-full gap-3 px-3 py-2.5 text-left hover:bg-accent",
                        !read && "bg-primary/5"
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          ICON_COLOR[n.tipo]
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !read && "font-medium",
                            completed && "line-through opacity-60"
                          )}
                        >
                          {n.mensaje}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {fmtDateTime(n.created_at)}
                        </p>
                      </div>
                      {!read && !completed && (
                        <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                    {/* Quick actions inline: aparecen al hover (desktop) o siempre (mobile) */}
                    <div className="absolute right-2 top-2.5 flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <div className="flex items-center gap-0.5 rounded-md border bg-card/95 p-0.5 shadow-sm backdrop-blur">
                        {showCompleteBtn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteTask(n);
                            }}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            title="Marcar tarea como completada"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkReadOnly(n);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Marcar como leída (sin abrir)"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
