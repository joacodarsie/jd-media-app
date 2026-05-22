"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPayment,
  updatePayment,
  deletePayment,
} from "@/app/(app)/finanzas/actions";
import { currentPeriod } from "@/lib/finanzas";

export interface UserForPayment {
  id: string;
  nombre: string;
}

interface BaseProps {
  users: UserForPayment[];
  trigger: React.ReactNode;
  clients?: { id: string; nombre: string }[];
}

interface CreateProps extends BaseProps {
  mode: "create";
  defaultUserId?: string;
}

interface EditProps extends BaseProps {
  mode: "edit";
  payment: {
    id: string;
    user_id: string;
    concepto: string;
    monto: number;
    moneda: string;
    periodo: string;
    fecha_programada: string;
    notas: string | null;
    cliente_id?: string | null;
  };
}

const NO_CLIENT = "__none__";

export function PaymentFormDialog(props: CreateProps | EditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const initial =
    props.mode === "edit"
      ? props.payment
      : {
          user_id: props.defaultUserId ?? "",
          concepto: "",
          monto: 0,
          moneda: "ARS",
          periodo: currentPeriod(),
          fecha_programada: new Date().toISOString().slice(0, 10),
          notas: null as string | null,
          cliente_id: null as string | null,
        };

  const [userId, setUserId] = useState(initial.user_id);
  const [concepto, setConcepto] = useState(initial.concepto);
  const [monto, setMonto] = useState<string>(String(initial.monto ?? ""));
  const [moneda, setMoneda] = useState(initial.moneda);
  const [periodo, setPeriodo] = useState(initial.periodo);
  const [fecha, setFecha] = useState(initial.fecha_programada);
  const [notas, setNotas] = useState(initial.notas ?? "");
  const [clienteId, setClienteId] = useState<string>(initial.cliente_id ?? NO_CLIENT);

  function submit() {
    if (!userId) {
      toast.error("Elegí persona.");
      return;
    }
    if (!concepto.trim()) {
      toast.error("Escribí un concepto.");
      return;
    }
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Monto inválido.");
      return;
    }
    start(async () => {
      const cliente_id = clienteId === NO_CLIENT ? null : clienteId;
      const res =
        props.mode === "create"
          ? await createPayment({
              user_id: userId,
              concepto,
              monto: m,
              moneda,
              periodo,
              fecha_programada: fecha,
              notas: notas || null,
              cliente_id,
            })
          : await updatePayment(props.payment.id, {
              concepto,
              monto: m,
              moneda,
              fecha_programada: fecha,
              notas: notas || null,
              cliente_id,
            });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Pago creado" : "Actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (props.mode !== "edit") return;
    if (!confirm("¿Eliminar este pago?")) return;
    start(async () => {
      const res = await deletePayment(props.payment.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Eliminado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Nuevo pago" : "Editar pago"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Persona</Label>
            <Select
              value={userId}
              onValueChange={setUserId}
              disabled={props.mode === "edit"}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Elegí persona" />
              </SelectTrigger>
              <SelectContent>
                {props.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Bonus proyecto X, Comisión venta, Tarea extra"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="h-9 text-right tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Período</Label>
              <Input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                disabled={props.mode === "edit"}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Fecha programada</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalle interno"
              className="h-9"
            />
          </div>
          {props.clients && props.clients.length > 0 && (
            <div>
              <Label className="text-xs">Imputar a cliente (opcional)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>
                    Sin cliente (costo general del equipo)
                  </SelectItem>
                  {props.clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Si este pago corresponde a trabajo en un cliente puntual, marcarlo
                ayuda a calcular su rentabilidad real.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {props.mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={pending}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Eliminar
            </Button>
          )}
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {props.mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
