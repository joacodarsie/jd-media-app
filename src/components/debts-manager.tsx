"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Check, RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtCurrency } from "@/lib/finanzas";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addDebt, updateDebt, deleteDebt, toggleDebtSaldada } from "@/app/(app)/finanzas/debts-actions";

export interface DebtRow {
  id: string;
  acreedor: string;
  monto: number;
  moneda: string;
  detalle: string | null;
  fecha: string | null;
  saldada: boolean;
  fecha_saldada: string | null;
}

export function DebtsManager({ debts }: { debts: DebtRow[] }) {
  const activas = debts.filter((d) => !d.saldada);
  const saldadas = debts.filter((d) => d.saldada);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lo que debés ({activas.length})
        </h2>
        <DebtDialog mode="create" trigger={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nueva deuda
          </Button>
        } />
      </div>

      {activas.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No tenés deudas cargadas. 🎉
        </p>
      ) : (
        <ul className="space-y-2">
          {activas.map((d) => (
            <DebtItem key={d.id} debt={d} />
          ))}
        </ul>
      )}

      {saldadas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Saldadas ({saldadas.length})
          </summary>
          <ul className="mt-2 space-y-2 opacity-70">
            {saldadas.map((d) => (
              <DebtItem key={d.id} debt={d} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DebtItem({ debt: d }: { debt: DebtRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const res = await toggleDebtSaldada(d.id, !d.saldada);
      if (res?.error) return void toast.error(res.error);
      toast.success(d.saldada ? "Marcada como pendiente" : "¡Saldada! 🙌");
      router.refresh();
    });
  }
  function remove() {
    if (!confirm(`¿Eliminar la deuda con ${d.acreedor}?`)) return;
    start(async () => {
      const res = await deleteDebt(d.id);
      if (res?.error) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <li className={cn("flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{d.acreedor}</span>
          {d.saldada && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              saldada {d.fecha_saldada ? fmtDate(d.fecha_saldada) : ""}
            </span>
          )}
        </div>
        {(d.detalle || d.fecha) && (
          <div className="truncate text-xs text-muted-foreground">
            {d.detalle}
            {d.detalle && d.fecha ? " · " : ""}
            {d.fecha ? `desde ${fmtDate(d.fecha)}` : ""}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("text-lg font-bold tabular-nums", !d.saldada && "text-red-600")}>
          {fmtCurrency(Number(d.monto), d.moneda)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggle}
          disabled={pending}
          title={d.saldada ? "Volver a pendiente" : "Marcar saldada"}
        >
          {d.saldada ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
        </Button>
        <DebtDialog
          mode="edit"
          debt={d}
          trigger={
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={remove} disabled={pending} title="Eliminar">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
        </Button>
      </div>
    </li>
  );
}

function DebtDialog({
  mode,
  debt,
  trigger,
}: {
  mode: "create" | "edit";
  debt?: DebtRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [acreedor, setAcreedor] = useState(debt?.acreedor ?? "");
  const [monto, setMonto] = useState(debt?.monto != null ? String(debt.monto) : "");
  const [moneda, setMoneda] = useState(debt?.moneda ?? "ARS");
  const [detalle, setDetalle] = useState(debt?.detalle ?? "");
  const [fecha, setFecha] = useState(debt?.fecha ?? "");

  function submit() {
    const input = {
      acreedor,
      monto: Number(monto),
      moneda,
      detalle: detalle || null,
      fecha: fecha || null,
    };
    start(async () => {
      const res = mode === "create" ? await addDebt(input) : await updateDebt(debt!.id, input);
      if (res?.error) return void toast.error(res.error);
      toast.success(mode === "create" ? "Deuda cargada" : "Actualizada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva deuda" : "Editar deuda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>A quién le debés</Label>
            <Input value={acreedor} onChange={(e) => setAcreedor(e.target.value)} placeholder="Ej: Papá, Mamá, banco…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Monto</Label>
              <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger>
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
          <div>
            <Label>Detalle (opcional)</Label>
            <Textarea rows={2} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Para qué fue, condiciones…" />
          </div>
          <div>
            <Label>Desde (opcional)</Label>
            <Input type="date" value={fecha ? fecha.slice(0, 10) : ""} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
