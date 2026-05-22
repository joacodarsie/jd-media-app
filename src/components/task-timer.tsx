"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Pause, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  startTimer,
  stopTimer,
  deleteEntry,
  logManualEntry,
} from "@/app/(app)/tareas/time-actions";

export interface TimeEntry {
  id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_seg: number | null;
  notas: string | null;
  autor?: { id: string; nombre: string } | null;
}

function fmtDuration(seg: number): string {
  if (seg < 60) return `${seg}s`;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TaskTimer({
  taskId,
  entries,
  currentUserId,
}: {
  taskId: string;
  entries: TimeEntry[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState<number>(Date.now());

  const myOpen = entries.find(
    (e) => e.user_id === currentUserId && e.stopped_at === null
  );

  // Tick para mostrar el contador en vivo
  useEffect(() => {
    if (!myOpen) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [myOpen]);

  function onStart() {
    start(async () => {
      const res = await startTimer(taskId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Timer arrancado");
      router.refresh();
    });
  }

  function onStop() {
    start(async () => {
      const res = await stopTimer(taskId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Timer pausado");
      router.refresh();
    });
  }

  function onDelete(entryId: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    start(async () => {
      const res = await deleteEntry(entryId, taskId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Tiempo total acumulado (todos los users) de la tarea
  const totalSeg = entries.reduce(
    (acc, e) => acc + (e.duration_seg ?? 0),
    0
  );
  const myTotalSeg = entries
    .filter((e) => e.user_id === currentUserId)
    .reduce((acc, e) => acc + (e.duration_seg ?? 0), 0);

  // Si tengo un timer abierto, sumar el live time
  const liveSeg = myOpen
    ? Math.floor((now - new Date(myOpen.started_at).getTime()) / 1000)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {myOpen ? (
          <Button
            onClick={onStop}
            disabled={pending}
            className="gap-1.5 bg-red-600 hover:bg-red-700"
            size="sm"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            Pausar ({fmtDuration(liveSeg)})
          </Button>
        ) : (
          <Button onClick={onStart} disabled={pending} className="gap-1.5" size="sm">
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Arrancar timer
          </Button>
        )}

        <ManualEntryPopover taskId={taskId} />

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <Clock className="mr-1 inline h-3 w-3" />
            Tu total:{" "}
            <b className="text-foreground">{fmtDuration(myTotalSeg + liveSeg)}</b>
          </span>
          {totalSeg !== myTotalSeg && (
            <span>
              Equipo: <b className="text-foreground">{fmtDuration(totalSeg)}</b>
            </span>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Ver registros ({entries.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1"
              >
                <div className="flex-1">
                  <span className="font-medium">
                    {e.autor?.nombre ?? "Alguien"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {new Date(e.started_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {e.notas && (
                    <span className="text-muted-foreground"> — {e.notas}</span>
                  )}
                </div>
                <span className="tabular-nums font-mono">
                  {e.duration_seg !== null
                    ? fmtDuration(e.duration_seg)
                    : "en curso…"}
                </span>
                {e.user_id === currentUserId && (
                  <button
                    onClick={() => onDelete(e.id)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-red-600"
                    title="Eliminar registro"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ManualEntryPopover({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [notas, setNotas] = useState("");
  const [pending, start] = useTransition();

  function save() {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Minutos inválidos");
      return;
    }
    start(async () => {
      const res = await logManualEntry(taskId, m, notas);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Registro agregado");
      setMinutes("");
      setNotas("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Agregar manual
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <div>
          <Label className="text-xs">Minutos trabajados</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-8 text-sm tabular-nums"
            placeholder="60"
          />
        </div>
        <div>
          <Label className="text-xs">Notas (opcional)</Label>
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="h-8 text-xs"
            placeholder="Qué hiciste"
          />
        </div>
        <Button onClick={save} disabled={pending || !minutes} className="w-full" size="sm">
          {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Guardar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
