"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Loader2,
  Maximize2,
  MessageSquare,
  User,
} from "lucide-react";
import {
  verTareaRapido,
  type TareaEnVistaRapida,
} from "@/app/(app)/tareas/vista-rapida";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { fmtDate, dueState } from "@/lib/dates";
import { formatTicket } from "@/lib/tareas/tickets";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { TaskStatusSelect } from "@/components/task-status-select";
import { cn } from "@/lib/utils";

/**
 * La ventanita de vista rápida de una tarea (estilo "peek" de Notion).
 *
 * Nace en el mapa de arranques: tocar un paso llevaba directo a la página
 * completa de la tarea, y volver al panorama costaba dos clics. Para "ver por
 * arriba de qué se trata el paso" eso es carísimo, así que ahora se abre acá
 * encima y la página completa queda a un botón.
 *
 * Se usa con el provider: cualquier hijo llama `useTareaPeek().abrir(id)`.
 */

const PeekContext = createContext<{ abrir: (id: string) => void } | null>(null);

/** Abre la vista rápida de una tarea desde cualquier lugar del árbol. */
export function useTareaPeek() {
  const ctx = useContext(PeekContext);
  if (!ctx) throw new Error("useTareaPeek necesita un <TareaPeekProvider>");
  return ctx;
}

/**
 * Igual, pero devuelve `null` si no hay provider.
 *
 * Lo usa el mapa del arranque, que vive en dos lugares: en el panorama sus
 * nodos son tareas y hay ventanita, y adentro de la cuenta son ítems de un
 * checklist que no tienen ticket detrás.
 */
export function useTareaPeekSiHay() {
  return useContext(PeekContext);
}

export function TareaPeekProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const abrir = useCallback((tareaId: string) => setId(tareaId), []);

  return (
    <PeekContext.Provider value={{ abrir }}>
      {children}
      <TareaPeekDialog id={id} onClose={() => setId(null)} />
    </PeekContext.Provider>
  );
}

function TareaPeekDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [tarea, setTarea] = useState<TareaEnVistaRapida | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // La tarea anterior se limpia: si no, al abrir otra se ve medio segundo
    // la de antes y parece que el clic abrió la equivocada.
    setTarea(null);
    setError(null);
    let vigente = true;
    verTareaRapido(id).then((res) => {
      if (!vigente) return;
      if ("error" in res) setError(res.error);
      else setTarea(res.tarea);
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {/* Radix pide un título accesible siempre; cuando la tarea cargó, el
            título visible es el de la tarea y este queda oculto. */}
        <DialogTitle className="sr-only">
          {tarea ? tarea.titulo : "Vista rápida de la tarea"}
        </DialogTitle>
        {!tarea && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Abriendo…
          </div>
        )}
        {error && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {error}
          </p>
        )}
        {tarea && <Cuerpo tarea={tarea} />}
      </DialogContent>
    </Dialog>
  );
}

function Cuerpo({ tarea }: { tarea: TareaEnVistaRapida }) {
  const due = dueState(tarea.fecha_limite, tarea.estado);
  const hechas = tarea.subtareas.filter(
    (s) => s.estado === "completada" || s.estado === "archivada"
  ).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 pr-8">
        {tarea.numero !== null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatTicket(tarea.numero)}
          </span>
        )}
        <h2 className="text-lg font-semibold leading-snug">{tarea.titulo}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {tarea.cliente && (
            <Link
              href={`/clientes/${tarea.cliente.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {tarea.cliente.nombre}
            </Link>
          )}
          {tarea.area && <span>{tarea.area}</span>}
          {tarea.asignado && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {tarea.asignado.nombre}
            </span>
          )}
          {tarea.fecha_limite && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                due === "vencida" && "font-medium text-red-600 dark:text-red-400",
                due === "hoy" && "font-medium text-amber-600 dark:text-amber-400"
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {fmtDate(tarea.fecha_limite)}
              {due === "vencida" && " · atrasada"}
              {due === "hoy" && " · es hoy"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TaskStatusSelect
          id={tarea.id}
          estado={tarea.estado as TaskStatus}
          className="h-8 w-44 text-xs"
        />
        {tarea.prioridad && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              PRIORITY_BADGE[tarea.prioridad as TaskPriority]
            )}
          >
            {PRIORITY_LABEL[tarea.prioridad as TaskPriority] ?? tarea.prioridad}
          </span>
        )}
        <Button asChild size="sm" variant="outline" className="ml-auto gap-1.5">
          <Link href={`/tareas/${tarea.id}`}>
            <Maximize2 className="h-3.5 w-3.5" />
            Abrir la tarea completa
          </Link>
        </Button>
      </div>

      {tarea.descripcion ? (
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <Markdown>{tarea.descripcion}</Markdown>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Esta tarea no tiene descripción cargada.
        </p>
      )}

      {tarea.subtareas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Desglose · {hechas} de {tarea.subtareas.length}
          </p>
          <ul className="divide-y rounded-lg border">
            {tarea.subtareas.map((s) => {
              const lista = s.estado === "completada" || s.estado === "archivada";
              return (
                <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      lista
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {lista && <Check className="h-3 w-3" />}
                  </span>
                  <Link
                    href={`/tareas/${s.id}`}
                    className={cn(
                      "min-w-0 flex-1 truncate hover:underline",
                      lista && "text-muted-foreground line-through"
                    )}
                  >
                    {s.titulo}
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                      STATUS_BADGE[s.estado as TaskStatus]
                    )}
                  >
                    {STATUS_LABEL[s.estado as TaskStatus] ?? s.estado}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tarea.comentarios > 0 && tarea.ultimoComentario && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {tarea.comentarios} comentario{tarea.comentarios === 1 ? "" : "s"} ·
            último de {tarea.ultimoComentario.autor ?? "alguien"}
          </p>
          <p className="line-clamp-3 text-sm">{tarea.ultimoComentario.texto}</p>
        </div>
      )}
    </div>
  );
}
