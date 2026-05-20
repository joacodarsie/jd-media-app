"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTask, updateTask } from "@/app/(app)/tareas/actions";
import { AREAS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { AppUser, Client, TaskWithRels } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function TaskFormDialog({
  mode,
  task,
  users,
  clients,
  trigger,
}: {
  mode: "create" | "edit";
  task?: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [titulo, setTitulo] = useState<string>(task?.titulo ?? "");
  const [descripcion, setDescripcion] = useState<string>(
    task?.descripcion ?? ""
  );
  const [asignado, setAsignado] = useState<string>(
    task?.asignado_a_id ?? NONE
  );
  const [cliente, setCliente] = useState<string>(task?.cliente_id ?? NONE);
  const [area, setArea] = useState<string>(task?.area ?? "Creativas");
  const [prioridad, setPrioridad] = useState<string>(
    task?.prioridad ?? "media"
  );
  const [estado, setEstado] = useState<string>(task?.estado ?? "pendiente");
  const [fecha, setFecha] = useState<string>(
    task?.fecha_limite?.slice(0, 10) ?? ""
  );

  function submit() {
    if (!titulo.trim()) {
      toast.error("Poné un título.");
      return;
    }
    start(async () => {
      const payload = {
        titulo: titulo.trim(),
        descripcion,
        asignado_a_id: asignado === NONE ? null : asignado,
        cliente_id: cliente === NONE ? null : cliente,
        area,
        prioridad,
        fecha_limite: fecha || null,
      };
      const res =
        mode === "create"
          ? await createTask(payload)
          : await updateTask(task!.id, { ...payload, estado });
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success(mode === "create" ? "Tarea creada" : "Tarea actualizada");
      setOpen(false);
      if (mode === "create") {
        setTitulo("");
        setDescripcion("");
        setAsignado(NONE);
        setCliente(NONE);
        setFecha("");
      }
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva tarea" : "Editar tarea"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Calendario de contenido junio"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descripción (acepta Markdown)</Label>
            <Textarea
              id="desc"
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="**Detalle** de la tarea, checklist, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select value={asignado} onValueChange={setAsignado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Interna (sin cliente)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "edit" && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha límite</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
