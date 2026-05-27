"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createContract } from "@/app/(app)/contratos/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function ContractNewDialog({
  users,
  positions,
  trigger,
}: {
  users: { id: string; nombre: string }[];
  positions: { id: string; nombre: string }[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [userId, setUserId] = useState("");
  const [positionId, setPositionId] = useState(NONE);
  const [rol, setRol] = useState("");
  const [compType, setCompType] = useState<
    "comision" | "fee_fijo" | "por_entrega" | "mixto"
  >("comision");
  const [compDetail, setCompDetail] = useState("");
  const [fechaInicio, setFechaInicio] = useState(
    new Date().toISOString().slice(0, 10)
  );

  function submit() {
    if (!userId) {
      toast.error("Elegí la persona");
      return;
    }
    start(async () => {
      const res = await createContract({
        user_id: userId,
        position_id: positionId === NONE ? null : positionId,
        rol_descripcion: rol || null,
        compensation_type: compType,
        compensation_detail: compDetail || null,
        fecha_inicio: fechaInicio,
        estado: "borrador",
      });
      if (res?.error) {
        toast.error("No se pudo crear: " + res.error);
        return;
      }
      toast.success("Contrato creado en borrador");
      setOpen(false);
      if (res.id) router.push(`/contratos/${res.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Persona del equipo</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí persona…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Puesto</Label>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Sin puesto —</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción del rol (opcional)</Label>
            <Input
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              placeholder="Ej: Community Manager para 3 clientes"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de compensación</Label>
            <Select
              value={compType}
              onValueChange={(v) => setCompType(v as typeof compType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comision">Comisión (%)</SelectItem>
                <SelectItem value="fee_fijo">Fee fijo mensual</SelectItem>
                <SelectItem value="por_entrega">Por entrega / producción</SelectItem>
                <SelectItem value="mixto">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Detalle de compensación</Label>
            <Input
              value={compDetail}
              onChange={(e) => setCompDetail(e.target.value)}
              placeholder="Ej: 30% del cobro del cliente Nico Liberto"
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
            {pending ? "Creando…" : "Crear y editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
