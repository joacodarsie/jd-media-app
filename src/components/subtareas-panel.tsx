"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Loader2, Maximize2, Plus } from "lucide-react";
import { addSubtarea } from "@/app/(app)/tareas/actions";
import { reasignarTarea } from "@/app/(app)/tareas/aprobacion-actions";
import { formatTicket, progresoTicket } from "@/lib/tareas/tickets";
import { TaskFormDialog } from "@/components/task-form-dialog";
import type { AppUser, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_BADGE } from "@/lib/constants";

export interface SubtareaFila {
  id: string;
  numero: number | null;
  titulo: string;
  estado: string;
  fecha_limite: string | null;
  asignado: { id: string; nombre: string } | null;
}

/** El ticket del que cuelga el desglose. */
export interface TicketMadre {
  id: string;
  titulo: string;
  numero: number | null;
  cliente_id: string | null;
  area: string;
  prioridad: string;
}

const HECHA = new Set(["completada", "archivada"]);

/**
 * El desglose de un ticket madre.
 *
 * Es la pieza central de lo que el dueño pidió el 13/9: un ticket ("los 15 días
 * de contenido", "Destacadas") con adentro una subtarea por publicación o por
 * pieza. El alta es de una línea a propósito — cliente, área y prioridad los
 * hereda de la madre — porque cargar quince subtareas con un formulario largo
 * no lo hace nadie.
 *
 * Y cuando una subtarea sí necesita desarrollarse (el copy entero, las
 * referencias, marcarla como posteo del calendario), el botón «Con detalle»
 * abre la ventana grande en vez de un recuadro de tres renglones. Ese recuadro
 * chico era el que hacía que cargar bien una subtarea fuera incómodo (20/9).
 */
export function SubtareasPanel({
  parent,
  subtareas,
  usuarios,
  clientes = [],
  piezaPorSubtarea = {},
  reparte = false,
  puerta = null,
}: {
  parent: TicketMadre;
  subtareas: SubtareaFila[];
  usuarios: Pick<AppUser, "id" | "nombre">[];
  /** Solo para la ventana grande; la subtarea hereda la cuenta del ticket. */
  clientes?: Pick<Client, "id" | "nombre">[];
  /** subtarea.id → id de la pieza del calendario, si es un posteo. */
  piezaPorSubtarea?: Record<string, string>;
  /** La PM (o la dirección): el responsable de cada fila se cambia ahí mismo. */
  reparte?: boolean;
  /** Si viene, el pedido le llega a la PM: no se elige responsable. */
  puerta?: { pmNombre: string } | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [asignado, setAsignado] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  const prog = progresoTicket(subtareas);

  async function agregar() {
    if (!titulo.trim()) return;
    setGuardando(true);
    const res = await addSubtarea({
      parentId: parent.id,
      titulo,
      descripcion: null,
      asignado_a_id: asignado || null,
      fecha_limite: fecha || null,
      links: [],
    });
    setGuardando(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    // El responsable y la fecha quedan puestos: cargar quince placas seguidas
    // para la misma persona no puede obligar a elegirla quince veces.
    setTitulo("");
    toast.success("Subtarea agregada");
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          Desglose{" "}
          {!prog.sinSubtareas && (
            <span className="ml-1 font-normal text-muted-foreground">
              {prog.hechas} de {prog.total} listas
            </span>
          )}
        </h2>
        {!prog.sinSubtareas && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round(prog.pct * 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(prog.pct * 100)}%
            </span>
          </div>
        )}
      </div>

      {subtareas.length > 0 && (
        <ul className="divide-y">
          {subtareas.map((s) => {
            const hecha = HECHA.has(s.estado);
            const piezaId = piezaPorSubtarea[s.id];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatTicket(s.numero) ?? "—"}
                </span>
                <Link
                  href={`/tareas/${s.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate hover:underline",
                    hecha && "text-muted-foreground line-through"
                  )}
                >
                  {s.titulo}
                </Link>
                {/* Si la subtarea es un posteo del calendario, se ve acá: era
                    lo que el dueño no encontraba al mirar el desglose. */}
                {piezaId && (
                  <Link
                    href={`/contenidos?pub=${piezaId}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                    title="Está en el calendario de contenidos"
                  >
                    <CalendarDays className="h-3 w-3" /> Pieza
                  </Link>
                )}
                {/* El estado de cada subtarea: sin esto el desglose no dice
                    en qué anda cada paso, solo si terminó o no. */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    STATUS_BADGE[s.estado as keyof typeof STATUS_BADGE]
                  )}
                >
                  {STATUS_LABEL[s.estado as keyof typeof STATUS_LABEL] ?? s.estado}
                </span>
                {reparte && !hecha ? (
                  <Select
                    value={s.asignado?.id}
                    onValueChange={async (v) => {
                      const res = await reasignarTarea(s.id, v);
                      if (res?.error) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success("Asignada");
                      startTransition(() => router.refresh());
                    }}
                  >
                    <SelectTrigger className="h-7 w-40 shrink-0 text-xs">
                      <SelectValue placeholder="Asignar a…" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  s.asignado && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.asignado.nombre}
                    </span>
                  )
                )}
                {s.fecha_limite && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {s.fecha_limite.slice(8, 10)}/{s.fecha_limite.slice(5, 7)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 border-t p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label className="text-[11px] text-muted-foreground">Nueva subtarea</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !guardando) agregar();
              }}
              placeholder="Ej: Portada destacada «Servicios»"
              className="h-8 text-xs"
            />
          </div>
          {puerta ? (
            <p className="pb-2 text-[11px] text-muted-foreground">
              Le llega a {puerta.pmNombre.split(" ")[0]}, que la reparte.
            </p>
          ) : (
            <div>
              <Label className="text-[11px] text-muted-foreground">Responsable</Label>
              <Select value={asignado} onValueChange={setAsignado}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Como el ticket" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-[11px] text-muted-foreground">Entrega</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <Button size="sm" onClick={agregar} disabled={guardando || !titulo.trim()}>
            {guardando ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3.5 w-3.5" />
            )}
            Agregar
          </Button>
          <TaskFormDialog
            mode="create"
            users={usuarios}
            clients={clientes}
            parent={parent}
            trigger={
              <Button variant="outline" size="sm" className="h-8">
                <Maximize2 className="mr-1 h-3.5 w-3.5" />
                Con detalle
              </Button>
            }
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          La línea de arriba es para cargar varias de una. <b>Con detalle</b> abre la ventana
          grande: descripción larga, links de referencia y la opción de marcarla como posteo del
          calendario. La subtarea hereda cuenta, área y prioridad del ticket.
        </p>
      </div>
    </section>
  );
}
