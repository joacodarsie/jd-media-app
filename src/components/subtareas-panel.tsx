"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { addSubtarea } from "@/app/(app)/tareas/actions";
import { formatTicket, progresoTicket } from "@/lib/tareas/tickets";
import { normalizarLinks, type LinkBorrador } from "@/lib/tareas/links";
import { LinksEditor } from "@/components/links-editor";
import { Textarea } from "@/components/ui/textarea";
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

const HECHA = new Set(["completada", "archivada"]);

/**
 * El desglose de un ticket madre.
 *
 * Es la pieza central de lo que el dueño pidió el 13/9: un ticket ("los 15 días
 * de contenido", "Destacadas") con adentro una subtarea por publicación o por
 * pieza. El alta es de una línea a propósito — cliente, área y prioridad los
 * hereda de la madre — porque cargar quince subtareas con un formulario largo
 * no lo hace nadie.
 */
export function SubtareasPanel({
  parentId,
  subtareas,
  usuarios,
}: {
  parentId: string;
  subtareas: SubtareaFila[];
  usuarios: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [asignado, setAsignado] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  // El detalle de la subtarea (copy, indicaciones, referencias), plegado para
  // que cargar muchas seguidas siga siendo de una línea.
  const [conDetalle, setConDetalle] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [links, setLinks] = useState<LinkBorrador[]>([]);

  const prog = progresoTicket(subtareas);

  async function agregar() {
    if (!titulo.trim()) return;
    const l = normalizarLinks(links);
    if (l.error) {
      toast.error(l.error);
      return;
    }
    setGuardando(true);
    const res = await addSubtarea({
      parentId,
      titulo,
      descripcion: descripcion || null,
      asignado_a_id: asignado || null,
      fecha_limite: fecha || null,
      links: l.links,
    });
    setGuardando(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    // El responsable y la fecha quedan puestos: cargar quince placas seguidas
    // para la misma persona no puede obligar a elegirla quince veces.
    setTitulo("");
    setDescripcion("");
    setLinks([]);
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
                {s.asignado && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.asignado.nombre}
                  </span>
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
          <div>
            <Label className="text-[11px] text-muted-foreground">Entrega</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setConDetalle((v) => !v)}
          >
            {conDetalle ? (
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="mr-1 h-3.5 w-3.5" />
            )}
            Detalle
          </Button>
          <Button size="sm" onClick={agregar} disabled={guardando || !titulo.trim()}>
            {guardando ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3.5 w-3.5" />
            )}
            Agregar
          </Button>
        </div>
        {conDetalle && (
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <Textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="El detalle de esta subtarea: el copy exacto, qué va en cada placa, indicaciones para diseño o edición…"
              className="bg-background text-sm"
            />
            <LinksEditor value={links} onChange={setLinks} compacto />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Cada subtarea se abre con su propia ficha: descripción, links, comentarios e historial. La subtarea hereda cliente, área y prioridad del ticket. Si no elegís responsable
          o fecha, usa los del ticket.
        </p>
      </div>
    </section>
  );
}
