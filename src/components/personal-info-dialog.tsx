"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updatePersonalInfo,
  type PersonalInput,
} from "@/app/(app)/equipo/person-actions";
import type { AppUser } from "@/lib/types";
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

export function PersonalInfoDialog({
  user,
  trigger,
}: {
  user: AppUser;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [fechaIngreso, setFechaIngreso] = useState(user.fecha_ingreso ?? "");
  const [telefono, setTelefono] = useState(user.telefono ?? "");
  const [dniCuit, setDniCuit] = useState(user.dni_cuit ?? "");
  const [cbu, setCbu] = useState(user.cbu ?? "");
  const [alias, setAlias] = useState(user.alias_cbu ?? "");
  const [titular, setTitular] = useState(user.titular_cuenta ?? "");
  const [notas, setNotas] = useState(user.notas_personales ?? "");

  function submit() {
    const payload: PersonalInput = {
      fecha_ingreso: fechaIngreso || null,
      telefono,
      dni_cuit: dniCuit,
      cbu,
      alias_cbu: alias,
      titular_cuenta: titular,
      notas_personales: notas,
    };
    start(async () => {
      const res = await updatePersonalInfo(user.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Datos personales guardados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Datos personales · {user.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha de ingreso a la agencia</Label>
              <Input
                type="date"
                value={fechaIngreso ? fechaIngreso.slice(0, 10) : ""}
                onChange={(e) => setFechaIngreso(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 9 351 ..."
              />
            </div>
            <div className="space-y-2">
              <Label>DNI o CUIT</Label>
              <Input
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alias CBU</Label>
              <Input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>CBU completo</Label>
              <Input
                value={cbu}
                onChange={(e) => setCbu(e.target.value)}
                placeholder="22 dígitos"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Titular de la cuenta</Label>
              <Input
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Como figura en el banco"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Aclaraciones, condiciones especiales, etc."
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Estos datos solo los ve el admin y vos mismo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
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
