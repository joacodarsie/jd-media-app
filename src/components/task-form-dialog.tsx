"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTask, updateTask } from "@/app/(app)/tareas/actions";
import { AREAS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { AppUser, Client, TaskWithRels } from "@/lib/types";
import { validarFechaLimite } from "@/lib/tareas/fecha-limite";
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
  tickets = [],
}: {
  mode: "create" | "edit";
  task?: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  trigger: React.ReactNode;
  /** Tickets madre abiertos, para poder crear la tarea ya colgada de uno. */
  tickets?: { id: string; numero: number | null; titulo: string }[];
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
  const [area, setArea] = useState<string>(task?.area ?? "Community Manager");
  const [prioridad, setPrioridad] = useState<string>(
    task?.prioridad ?? "media"
  );
  const [estado, setEstado] = useState<string>(task?.estado ?? "pendiente");
  const [fecha, setFecha] = useState<string>(
    task?.fecha_limite?.slice(0, 10) ?? ""
  );
  const [aprobador, setAprobador] = useState<string>(task?.aprobador_id ?? NONE);
  // Colgar la tarea de un ticket al crearla. Solo al crear: mover una tarea de
  // ticket después es otra cosa (arrastra el desglose) y no se resuelve acá.
  const [madre, setMadre] = useState<string>(NONE);

  function submit() {
    if (!titulo.trim()) {
      toast.error("Poné un título.");
      return;
    }
    // La fecha también se valida en el servidor; acá se avisa antes de mandar
    // para no perder lo escrito.
    const chequeo = validarFechaLimite(fecha);
    if (!chequeo.ok) {
      toast.error(chequeo.error!);
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
        fecha_limite: chequeo.fecha!,
        aprobador_id: aprobador === NONE ? null : aprobador,
        requiere_aprobacion: aprobador !== NONE,
        ...(mode === "create" && madre !== NONE ? { parent_id: madre } : {}),
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
        setMadre(NONE);
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
          {/* Colgar la tarea de un ticket, como el "parent" de Jira. Va PRIMERO
              porque cambia qué estás creando: una tarea suelta o un paso de un
              trabajo más grande. */}
          {mode === "create" && tickets.length > 0 && (
            <div className="space-y-2">
              <Label>Parte de un ticket</Label>
              <Select value={madre} onValueChange={setMadre}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tarea suelta</SelectItem>
                  {tickets.map((tk) => (
                    <SelectItem key={tk.id} value={tk.id}>
                      {tk.numero ? `JD-${tk.numero} · ` : ""}
                      {tk.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {madre !== NONE && (
                <p className="text-[11px] text-muted-foreground">
                  Va a quedar adentro de ese ticket, en su desglose.
                </p>
              )}
            </div>
          )}
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
              <Label htmlFor="fecha">
                Fecha límite <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Requiere aprobación de</Label>
              <Select value={aprobador} onValueChange={setAprobador}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No requiere aprobación</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Si elegís un aprobador, le llega notificación cuando se crea la tarea
                y cuando pasa a &quot;en revisión&quot; o &quot;completada&quot;.
              </p>
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
