"use client";

import { useEffect, useState, useTransition } from "react";
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
  createExpense,
  updateExpense,
  deleteExpense,
  type ExpenseCategory,
} from "@/app/(app)/finanzas/actions";
import { currentPeriod } from "@/lib/finanzas";
import { EXPENSE_CATEGORIES } from "@/lib/finanzas/expense-categories";

// EXPENSE_CATEGORIES vive ahora en @/lib/finanzas/expense-categories
// (server-safe). Se re-exporta para los componentes de cliente que ya lo
// importaban desde acá.
export { EXPENSE_CATEGORIES };

interface BaseProps {
  trigger: React.ReactNode;
  clients?: { id: string; nombre: string }[];
}

interface CreateProps extends BaseProps {
  mode: "create";
  defaultCategory?: ExpenseCategory;
}

interface EditProps extends BaseProps {
  mode: "edit";
  expense: {
    id: string;
    categoria: ExpenseCategory;
    proveedor: string | null;
    concepto: string;
    monto: number;
    moneda: string;
    periodo: string;
    fecha_programada: string | null;
    notas: string | null;
    recurrente: boolean;
    cliente_id?: string | null;
  };
}

const NO_CLIENT = "__none__";

export function ExpenseFormDialog(props: CreateProps | EditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const initial =
    props.mode === "edit"
      ? props.expense
      : {
          categoria: props.defaultCategory ?? ("plataformas" as ExpenseCategory),
          proveedor: "",
          concepto: "",
          monto: 0,
          moneda: "ARS",
          periodo: currentPeriod(),
          fecha_programada: new Date().toISOString().slice(0, 10),
          notas: null as string | null,
          recurrente: false,
          cliente_id: null as string | null,
        };

  const [categoria, setCategoria] = useState<ExpenseCategory>(initial.categoria);
  const [proveedor, setProveedor] = useState(initial.proveedor ?? "");
  const [concepto, setConcepto] = useState(initial.concepto);
  const [monto, setMonto] = useState<string>(String(initial.monto ?? ""));
  const [moneda, setMoneda] = useState(initial.moneda);
  const [periodo, setPeriodo] = useState(initial.periodo);
  const [fecha, setFecha] = useState(initial.fecha_programada ?? "");
  const [recurrente, setRecurrente] = useState(initial.recurrente);
  const [notas, setNotas] = useState(initial.notas ?? "");
  const [clienteId, setClienteId] = useState<string>(initial.cliente_id ?? NO_CLIENT);

  // Cotización cripto (informativa) para gastos en dólares: estima el ARS de hoy.
  // El congelado real lo hace el servidor al registrar el pago.
  const [cripto, setCripto] = useState<number | null>(null);
  useEffect(() => {
    if (moneda === "ARS" || cripto !== null) return;
    fetch("https://dolarapi.com/v1/dolares/cripto")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.compra && d?.venta) setCripto(Math.round((d.compra + d.venta) / 2));
      })
      .catch(() => {}); // sin cotización no pasa nada: es solo un hint
  }, [moneda, cripto]);

  function submit() {
    if (!concepto.trim()) {
      toast.error("Escribí qué gasto es.");
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
          ? await createExpense({
              categoria,
              proveedor: proveedor || null,
              concepto,
              monto: m,
              moneda,
              periodo,
              fecha_programada: fecha || null,
              recurrente,
              notas: notas || null,
              cliente_id,
            })
          : await updateExpense(props.expense.id, {
              categoria,
              proveedor: proveedor || null,
              concepto,
              monto: m,
              moneda,
              fecha_programada: fecha || null,
              recurrente,
              notas: notas || null,
              cliente_id,
            });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Gasto creado" : "Actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (props.mode !== "edit") return;
    if (!confirm("¿Eliminar este gasto?")) return;
    start(async () => {
      const res = await deleteExpense(props.expense.id);
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
            {props.mode === "create" ? "Nuevo gasto" : "Editar gasto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as ExpenseCategory)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Proveedor / servicio</Label>
            <Input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Ej: Notion, Meta Ads, Estudio contable, AFIP"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Detalle (ej: Plan Plus mensual)"
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
          {moneda !== "ARS" && (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {moneda === "USD" && cripto && Number(monto) > 0 && (
                <>
                  ≈ <b className="text-foreground">${Math.round(Number(monto) * cripto).toLocaleString("es-AR")}</b>{" "}
                  al dólar cripto de hoy (${cripto.toLocaleString("es-AR")}).{" "}
                </>
              )}
              Al registrar el pago, el monto se <b className="text-foreground">fija en pesos
              a la cotización {moneda === "USD" ? "cripto" : ""} de ese día</b> y queda
              anotada en el gasto.
            </p>
          )}
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
              <Label className="text-xs">Fecha (de pago o programada)</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={recurrente}
              onChange={(e) => setRecurrente(e.target.checked)}
              className="rounded"
            />
            Es recurrente (se repite todos los meses)
          </label>
          {props.clients && props.clients.length > 0 && (
            <div>
              <Label className="text-xs">Imputar a cliente (opcional)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>
                    Sin cliente (gasto operativo general)
                  </SelectItem>
                  {props.clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Si lo imputás a un cliente, se descuenta de su rentabilidad.
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs">Notas</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional"
              className="h-9"
            />
          </div>
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
