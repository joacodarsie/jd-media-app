"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCheck,
  CircleUser,
  DollarSign,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  changeLeadStage,
  convertLeadToClient,
  deleteLead,
  type LeadStage,
} from "@/app/(app)/comercial/actions";
import { Button } from "@/components/ui/button";
import { LeadFormDialog, type LeadInit } from "@/components/lead-form-dialog";

const STAGES: { value: LeadStage; label: string; color: string }[] = [
  { value: "nuevo", label: "Nuevo", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "contactado", label: "Contactado", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { value: "calificado", label: "Calificado", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  { value: "propuesta", label: "Propuesta", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { value: "negociacion", label: "Negociación", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "ganado", label: "Ganado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { value: "perdido", label: "Perdido", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
];

export interface LeadRow extends LeadInit {
  id: string;
  asignado_nombre?: string | null;
  servicio_nombre?: string | null;
  ganado_cliente_id?: string | null;
}

export function LeadKanban({
  leads,
  services,
  users,
}: {
  leads: LeadRow[];
  services: { slug: string; name: string }[];
  users: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [, startMove] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<LeadStage | null>(null);

  const byStage = new Map<LeadStage, LeadRow[]>();
  for (const s of STAGES) byStage.set(s.value, []);
  for (const l of leads) byStage.get(l.stage)?.push(l);

  function moveTo(id: string, stage: LeadStage) {
    setHoverStage(null);
    setDraggingId(null);
    startMove(async () => {
      const res = await changeLeadStage(id, stage);
      if (res?.error) {
        toast.error("No se pudo mover: " + res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {STAGES.map((s) => {
        const arr = byStage.get(s.value) ?? [];
        const totalMonto = arr.reduce(
          (acc, l) => acc + (l.monto_estimado ?? 0),
          0
        );
        const hovered = hoverStage === s.value && draggingId;
        return (
          <div
            key={s.value}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (hoverStage !== s.value) setHoverStage(s.value);
            }}
            onDragLeave={() => {
              if (hoverStage === s.value) setHoverStage(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || draggingId;
              if (id) moveTo(id, s.value);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors",
              hovered && "ring-2 ring-inset ring-primary"
            )}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-semibold",
                    s.color
                  )}
                >
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {arr.length}
                </span>
              </div>
              {totalMonto > 0 && (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  ${totalMonto.toLocaleString("es-AR")}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
              {arr.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
                  Sin leads acá.
                </p>
              ) : (
                arr.map((l) => (
                  <LeadCard
                    key={l.id}
                    lead={l}
                    services={services}
                    users={users}
                    dragging={draggingId === l.id}
                    onDragStart={() => setDraggingId(l.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setHoverStage(null);
                    }}
                  />
                ))
              )}
            </div>
            <div className="border-t p-2">
              <LeadFormDialog
                mode="create"
                defaultStage={s.value}
                services={services}
                users={users}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs text-muted-foreground"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Agregar
                  </Button>
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({
  lead,
  services,
  users,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadRow;
  services: { slug: string; name: string }[];
  users: { id: string; nombre: string }[];
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function remove() {
    if (!confirm(`¿Borrar el lead "${lead.nombre}"?`)) return;
    start(async () => {
      const res = await deleteLead(lead.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }
  function convert() {
    if (
      !confirm(
        `Crear cliente a partir de "${lead.nombre}"?\n\nSe va a:\n- Crear un cliente nuevo con los datos del lead\n- Agregar el servicio interesado al cliente (si tiene)\n- Marcar este lead como Ganado`
      )
    )
      return;
    start(async () => {
      const res = await convertLeadToClient(lead.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente creado");
      router.push(`/clientes/${res.clientId}`);
    });
  }
  const canConvert =
    (lead.stage === "ganado" || lead.stage === "negociacion") &&
    !lead.ganado_cliente_id;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-md border bg-background p-2 text-xs transition",
        dragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{lead.nombre}</div>
          {lead.empresa && (
            <div className="truncate text-[11px] text-muted-foreground">
              {lead.empresa}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <LeadFormDialog
            mode="edit"
            lead={lead}
            services={services}
            users={users}
            trigger={
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Pencil className="h-3 w-3" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={remove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {lead.monto_estimado != null && (
          <span className="inline-flex items-center gap-0.5">
            <DollarSign className="h-3 w-3" />
            {lead.moneda} {Number(lead.monto_estimado).toLocaleString("es-AR")}
          </span>
        )}
        {lead.servicio_nombre && (
          <span className="truncate">· {lead.servicio_nombre}</span>
        )}
      </div>

      {(lead.email || lead.telefono) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {lead.email && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <Mail className="h-3 w-3" /> {lead.email}
            </span>
          )}
          {lead.telefono && (
            <span className="inline-flex items-center gap-0.5">
              <Phone className="h-3 w-3" /> {lead.telefono}
            </span>
          )}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-0.5">
          <CircleUser className="h-3 w-3" />
          {lead.asignado_nombre ?? "Sin asignar"}
        </span>
        {lead.proxima_accion_at && (
          <span className="inline-flex items-center gap-0.5">
            <Calendar className="h-3 w-3" />
            {new Date(lead.proxima_accion_at).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </div>

      {lead.proxima_accion && (
        <div className="mt-1 truncate text-[11px] italic text-muted-foreground">
          → {lead.proxima_accion}
        </div>
      )}

      {lead.ganado_cliente_id ? (
        <Link
          href={`/clientes/${lead.ganado_cliente_id}`}
          className="mt-2 flex items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <CheckCheck className="h-3 w-3" /> Ver cliente <ArrowRight className="h-3 w-3" />
        </Link>
      ) : canConvert ? (
        <button
          type="button"
          onClick={convert}
          disabled={pending}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          <CheckCheck className="h-3 w-3" /> Convertir a cliente
        </button>
      ) : null}
    </div>
  );
}
