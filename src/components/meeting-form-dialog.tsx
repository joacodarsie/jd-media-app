"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  createInternalMeeting,
  updateInternalMeeting,
  deleteInternalMeeting,
} from "@/app/(app)/agenda/actions";
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

export interface MeetingFormUser {
  id: string;
  nombre: string;
}
export interface MeetingFormClient {
  id: string;
  nombre: string;
}

export interface MeetingFormInitial {
  id: string;
  titulo: string;
  descripcion: string | null;
  starts_at: string;
  ends_at: string;
  ubicacion: string | null;
  meet_link: string | null;
  client_id: string | null;
  attendee_ids: string[];
  created_by: string;
}

function toLocalInput(iso: string): string {
  // Devuelve "yyyy-MM-ddTHH:mm" en zona local para input[type=datetime-local].
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  // Interpreta "yyyy-MM-ddTHH:mm" como hora local y devuelve ISO UTC.
  return new Date(local).toISOString();
}

function defaultStart(seed?: Date): string {
  // Próxima media hora redonda. Si pasan seed, lo anclan a ese día a las 10:00.
  if (seed) {
    const d = new Date(seed);
    d.setHours(10, 0, 0, 0);
    return toLocalInput(d.toISOString());
  }
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toLocalInput(d.toISOString());
}

export function MeetingFormDialog({
  mode,
  initial,
  users,
  clients,
  currentUserId,
  trigger,
  initialDate,
}: {
  mode: "create" | "edit";
  initial?: MeetingFormInitial;
  users: MeetingFormUser[];
  clients: MeetingFormClient[];
  currentUserId: string;
  trigger: React.ReactNode;
  /** Si se pasa, precarga la fecha del form en create (default 10:00). */
  initialDate?: Date;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [startsLocal, setStartsLocal] = useState(
    initial ? toLocalInput(initial.starts_at) : defaultStart(initialDate)
  );
  const [durationMin, setDurationMin] = useState<number>(() => {
    if (initial) {
      return Math.max(
        15,
        Math.round(
          (new Date(initial.ends_at).getTime() -
            new Date(initial.starts_at).getTime()) /
            60000
        )
      );
    }
    return 30;
  });
  const [ubicacion, setUbicacion] = useState(initial?.ubicacion ?? "");
  const [meetLink, setMeetLink] = useState(initial?.meet_link ?? "");
  const [clienteId, setClienteId] = useState(initial?.client_id ?? NONE);
  const [attendees, setAttendees] = useState<Set<string>>(
    new Set(initial?.attendee_ids ?? [currentUserId])
  );

  useEffect(() => {
    if (!open) return;
    // Reset al abrir en modo create
    if (mode === "create" && !initial) {
      setTitulo("");
      setDescripcion("");
      setStartsLocal(defaultStart(initialDate));
      setDurationMin(30);
      setUbicacion("");
      setMeetLink("");
      setClienteId(NONE);
      setAttendees(new Set([currentUserId]));
    }
  }, [open, mode, initial, currentUserId, initialDate]);

  function toggleAttendee(uid: string) {
    setAttendees((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function submit() {
    if (!titulo.trim()) {
      toast.error("Poné un título.");
      return;
    }
    if (!startsLocal) {
      toast.error("Falta fecha y hora.");
      return;
    }
    const startsIso = fromLocalInput(startsLocal);
    const endsIso = new Date(
      new Date(startsIso).getTime() + durationMin * 60000
    ).toISOString();

    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion || null,
      starts_at: startsIso,
      ends_at: endsIso,
      ubicacion: ubicacion || null,
      meet_link: meetLink || null,
      client_id: clienteId === NONE ? null : clienteId,
      attendee_ids: [...attendees],
    };

    start(async () => {
      const res =
        mode === "create"
          ? await createInternalMeeting(payload)
          : await updateInternalMeeting(initial!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success(
        mode === "create" ? "Reunión agendada" : "Reunión actualizada"
      );
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!confirm("¿Eliminar esta reunión?")) return;
    start(async () => {
      const res = await deleteInternalMeeting(initial.id);
      if (res?.error) {
        toast.error("No se pudo eliminar: " + res.error);
        return;
      }
      toast.success("Reunión eliminada");
      setOpen(false);
      router.refresh();
    });
  }

  const canDelete =
    mode === "edit" && initial && initial.created_by === currentUserId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva reunión" : "Editar reunión"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-titulo">Título</Label>
            <Input
              id="m-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Daily, brainstorm cliente X, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-start">Inicio</Label>
              <Input
                id="m-start"
                type="datetime-local"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-dur">Duración (min)</Label>
              <Input
                id="m-dur"
                type="number"
                min={15}
                step={15}
                value={durationMin}
                onChange={(e) =>
                  setDurationMin(Math.max(15, Number(e.target.value) || 30))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Descripción (opcional)</Label>
            <Textarea
              id="m-desc"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Agenda, contexto, links..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-meet">Link de Meet/Zoom</Label>
              <Input
                id="m-meet"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-ubic">Ubicación</Label>
              <Input
                id="m-ubic"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Oficina, etc."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin cliente —</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Asistentes</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
              {users.map((u) => {
                const checked = attendees.has(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttendee(u.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      {u.nombre}
                      {u.id === currentUserId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (vos)
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Vos quedás como asistente automáticamente. Los asistentes reciben
              notificación al crear/editar.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={pending}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? "Guardando..."
              : mode === "create"
              ? "Agendar reunión"
              : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
