"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Target,
  Lightbulb,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createObjective,
  updateObjective,
  deleteObjective,
  addIdea,
  toggleIdea,
  removeIdea,
  type ObjectiveIdea,
} from "@/app/(app)/objetivos/actions";

export interface ObjectiveRow {
  id: string;
  area: string | null;
  titulo: string;
  detalle: string | null;
  ideas: ObjectiveIdea[];
  estado: "activo" | "logrado" | "pausado";
  orden: number;
}

interface Group {
  area: string | null;
  label: string;
  objetivos: ObjectiveRow[];
}

const ESTADO_META: Record<
  ObjectiveRow["estado"],
  { label: string; cls: string }
> = {
  activo: { label: "En curso", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  logrado: { label: "Logrado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  pausado: { label: "Pausado", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

export function ObjectivesBoard({
  groups,
  canEdit,
}: {
  groups: Group[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.area ?? "__general"} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h2>
            <div className="h-px flex-1 bg-border" />
            {canEdit && <AddObjectiveButton area={g.area} />}
          </div>

          {g.objetivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {g.area === null
                ? "Todavía no cargaste el objetivo general de la agencia."
                : "Sin objetivos para esta área."}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {g.objetivos.map((o) => (
                <ObjectiveCard key={o.id} obj={o} canEdit={canEdit} general={g.area === null} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ObjectiveCard({
  obj,
  canEdit,
  general,
}: {
  obj: ObjectiveRow;
  canEdit: boolean;
  general: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(obj.titulo);
  const [detalle, setDetalle] = useState(obj.detalle ?? "");
  const [nuevaIdea, setNuevaIdea] = useState("");

  const ideasHechas = obj.ideas.filter((i) => i.done).length;

  function saveEdit() {
    if (!titulo.trim()) return void toast.error("El título no puede quedar vacío.");
    start(async () => {
      const r = await updateObjective({ id: obj.id, titulo, detalle });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Objetivo actualizado.");
      setEditing(false);
      router.refresh();
    });
  }

  function setEstado(estado: ObjectiveRow["estado"]) {
    start(async () => {
      const r = await updateObjective({ id: obj.id, estado });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }

  function del() {
    if (!confirm("¿Borrar este objetivo?")) return;
    start(async () => {
      const r = await deleteObjective(obj.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Objetivo borrado.");
      router.refresh();
    });
  }

  function agregarIdea() {
    if (!nuevaIdea.trim()) return;
    start(async () => {
      const r = await addIdea(obj.id, nuevaIdea);
      if (!r.ok) return void toast.error(r.error);
      setNuevaIdea("");
      router.refresh();
    });
  }

  function toggle(ideaId: string) {
    start(async () => {
      await toggleIdea(obj.id, ideaId);
      router.refresh();
    });
  }

  function quitarIdea(ideaId: string) {
    start(async () => {
      await removeIdea(obj.id, ideaId);
      router.refresh();
    });
  }

  return (
    <Card className={cn(general && "border-primary/40")}>
      <CardContent className="space-y-3 p-4">
        {editing ? (
          <div className="space-y-2">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Objetivo" />
            <Textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={2}
              placeholder="Detalle (opcional): cómo se ve el éxito, plazo…"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={pending}>
                {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <Target className={cn("mt-0.5 h-4 w-4 shrink-0", general ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <div className="font-semibold leading-snug">{obj.titulo}</div>
                  {obj.detalle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{obj.detalle}</p>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-0.5">
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={del}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                    aria-label="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Estado */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(ESTADO_META) as ObjectiveRow["estado"][]).map((e) => (
                <button
                  key={e}
                  disabled={!canEdit || pending}
                  onClick={() => setEstado(e)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                    obj.estado === e ? ESTADO_META[e].cls : "text-muted-foreground hover:bg-muted",
                    !canEdit && "cursor-default"
                  )}
                >
                  {ESTADO_META[e].label}
                </button>
              ))}
              {obj.ideas.length > 0 && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {ideasHechas}/{obj.ideas.length} ideas
                </span>
              )}
            </div>

            {/* Ideas */}
            <div className="space-y-1.5 border-t pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" /> Ideas para llegar
              </div>
              {obj.ideas.length === 0 && !canEdit && (
                <p className="text-xs text-muted-foreground">Sin ideas cargadas.</p>
              )}
              {obj.ideas.map((idea) => (
                <div key={idea.id} className="group flex items-start gap-2 text-sm">
                  <button
                    disabled={!canEdit || pending}
                    onClick={() => toggle(idea.id)}
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      idea.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40",
                      !canEdit && "cursor-default"
                    )}
                    aria-label={idea.done ? "Marcar como pendiente" : "Marcar como hecha"}
                  >
                    {idea.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={cn("min-w-0 flex-1", idea.done && "text-muted-foreground line-through")}>
                    {idea.texto}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => quitarIdea(idea.id)}
                      className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                      aria-label="Quitar idea"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <div className="flex gap-1.5 pt-1">
                  <Input
                    value={nuevaIdea}
                    onChange={(e) => setNuevaIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarIdea();
                      }
                    }}
                    placeholder="Sumar una idea…"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={agregarIdea} disabled={pending || !nuevaIdea.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AddObjectiveButton({ area }: { area: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");

  function crear() {
    if (!titulo.trim()) return void toast.error("Escribí el objetivo.");
    start(async () => {
      const r = await createObjective({ area, titulo });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Objetivo agregado.");
      setTitulo("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Objetivo
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            crear();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Nuevo objetivo…"
        className="h-8 w-56 text-sm"
      />
      <Button size="sm" onClick={crear} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
