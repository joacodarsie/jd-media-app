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
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from "@/app/(app)/finanzas/actions";
import { currentPeriod } from "@/lib/finanzas";

export interface ClientForInvoice {
  id: string;
  nombre: string;
}

interface BaseProps {
  clients: ClientForInvoice[];
  trigger: React.ReactNode;
}

interface CreateProps extends BaseProps {
  mode: "create";
  defaultClientId?: string;
}

interface EditProps extends BaseProps {
  mode: "edit";
  invoice: {
    id: string;
    cliente_id: string;
    concepto: string;
    monto: number;
    moneda: string;
    periodo: string;
    fecha_vencimiento: string | null;
    notas: string | null;
  };
}

export function InvoiceFormDialog(props: CreateProps | EditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const initial =
    props.mode === "edit"
      ? props.invoice
      : {
          cliente_id: props.defaultClientId ?? "",
          concepto: "",
          monto: 0,
          moneda: "ARS",
          periodo: currentPeriod(),
          fecha_vencimiento: null as string | null,
          notas: null as string | null,
        };

  const [clienteId, setClienteId] = useState(initial.cliente_id);
  const [concepto, setConcepto] = useState(initial.concepto);
  const [monto, setMonto] = useState<string>(String(initial.monto ?? ""));
  const [moneda, setMoneda] = useState(initial.moneda);
  const [periodo, setPeriodo] = useState(initial.periodo);
  const [venc, setVenc] = useState(initial.fecha_vencimiento ?? "");
  const [notas, setNotas] = useState(initial.notas ?? "");

  function submit() {
    if (!clienteId) {
      toast.error("Elegí un cliente.");
      return;
    }
    if (!concepto.trim()) {
      toast.error("Escribí un concepto (qué se cobra).");
      return;
    }
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Monto inválido.");
      return;
    }
    start(async () => {
      const res =
        props.mode === "create"
          ? await createInvoice({
              cliente_id: clienteId,
              concepto,
              monto: m,
              moneda,
              periodo,
              fecha_vencimiento: venc || null,
              notas: notas || null,
            })
          : await updateInvoice(props.invoice.id, {
              concepto,
              monto: m,
              moneda,
              fecha_vencimiento: venc || null,
              notas: notas || null,
            });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Cobro creado" : "Actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (props.mode !== "edit") return;
    if (!confirm("¿Eliminar este cobro?")) return;
    start(async () => {
      const res = await deleteInvoice(props.invoice.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Eliminada");
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
            {props.mode === "create" ? "Nuevo cobro" : "Editar cobro"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select
              value={clienteId}
              onValueChange={setClienteId}
              disabled={props.mode === "edit"}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Elegí cliente" />
              </SelectTrigger>
              <SelectContent>
                {props.clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
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
              placeholder="Ej: Diseño etiquetas vinos, Pack reels enero, etc."
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
              <Label className="text-xs">Período (para reportar)</Label>
              <Input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                disabled={props.mode === "edit"}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Vencimiento</Label>
              <Input
                type="date"
                value={venc}
                onChange={(e) => setVenc(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalle interno, link a brief, etc."
              className="h-9"
            />
          </div>
          {props.mode === "create" && (
            <p className="rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
              Usá esto para ventas únicas (diseño puntual, etiquetas, etc.). Para
              servicios mensuales recurrentes usá <b>Generar mes</b>.
            </p>
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
