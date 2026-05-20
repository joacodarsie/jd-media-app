"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createClientRow,
  updateClientRow,
  type ClientInput,
} from "@/app/(app)/clientes/actions";
import { CLIENT_PACK_LABEL, CLIENT_STATUS_LABEL } from "@/lib/constants";
import type { AppUser, Client } from "@/lib/types";
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

export function ClientFormDialog({
  mode,
  client,
  users,
  trigger,
}: {
  mode: "create" | "edit";
  client?: Client;
  users: Pick<AppUser, "id" | "nombre">[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [nombre, setNombre] = useState(client?.nombre ?? "");
  const [rubro, setRubro] = useState(client?.rubro ?? "");
  const [pack, setPack] = useState<string>(client?.pack ?? "Presencia");
  const [estado, setEstado] = useState<string>(client?.estado ?? "activo");
  const [creativa, setCreativa] = useState(client?.creativa_asignada_id ?? NONE);
  const [fechaInicio, setFechaInicio] = useState(client?.fecha_inicio ?? "");
  const [monto, setMonto] = useState<string>(
    client?.monto_mensual != null ? String(client.monto_mensual) : ""
  );
  const [calUrl, setCalUrl] = useState(client?.calendario_url ?? "");
  const [driveUrl, setDriveUrl] = useState(client?.drive_url ?? "");
  const [contactoNombre, setContactoNombre] = useState(
    client?.contacto_nombre ?? ""
  );
  const [contactoEmail, setContactoEmail] = useState(client?.contacto_email ?? "");
  const [contactoTel, setContactoTel] = useState(client?.contacto_telefono ?? "");
  const [notas, setNotas] = useState(client?.notas ?? "");

  function submit() {
    if (!nombre.trim()) {
      toast.error("Falta el nombre.");
      return;
    }
    const payload: ClientInput = {
      nombre,
      rubro,
      pack,
      estado,
      creativa_asignada_id: creativa === NONE ? null : creativa,
      fecha_inicio: fechaInicio || null,
      monto_mensual: monto ? Number(monto) : null,
      calendario_url: calUrl,
      drive_url: driveUrl,
      contacto_nombre: contactoNombre,
      contacto_email: contactoEmail,
      contacto_telefono: contactoTel,
      notas,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createClientRow(payload)
          : await updateClientRow(client!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success(mode === "create" ? "Cliente creado" : "Cliente actualizado");
      setOpen(false);
      router.refresh();
      if (mode === "create" && res.ok && "id" in res) {
        router.push(`/clientes/${res.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo cliente" : "Editar cliente"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Input value={rubro} onChange={(e) => setRubro(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pack</Label>
              <Select value={pack} onValueChange={setPack}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_PACK_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={creativa} onValueChange={setCreativa}>
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
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={fechaInicio ? fechaInicio.slice(0, 10) : ""}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto mensual (ARS)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Calendario de contenidos (link)</Label>
              <Input
                placeholder="https://docs.google.com/spreadsheets/…"
                value={calUrl}
                onChange={(e) => setCalUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Drive / carpeta del cliente</Label>
              <Input
                placeholder="https://drive.google.com/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={contactoEmail}
                onChange={(e) => setContactoEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={contactoTel}
                onChange={(e) => setContactoTel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (Markdown)</Label>
            <Textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Tono de marca, preferencias, contraseñas que viven en 1password, etc."
            />
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
