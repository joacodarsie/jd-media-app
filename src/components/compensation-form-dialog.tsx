"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  upsertCompensation,
  clearCompensation,
} from "@/app/(app)/equipo/actions";
import { PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { Compensation } from "@/lib/types";
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

export function CompensationFormDialog({
  userId,
  userName,
  current,
  trigger,
}: {
  userId: string;
  userName: string;
  current?: Compensation | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [monto, setMonto] = useState<string>(
    current?.monto != null ? String(current.monto) : ""
  );
  const [moneda, setMoneda] = useState<string>(current?.moneda ?? "ARS");
  const [freq, setFreq] = useState<string>(current?.frecuencia ?? "mensual");
  const [forma, setForma] = useState(current?.forma_pago ?? "");
  const [notas, setNotas] = useState(current?.notas ?? "");

  function submit() {
    start(async () => {
      const res = await upsertCompensation({
        user_id: userId,
        monto: monto ? Number(monto) : null,
        moneda,
        frecuencia: freq,
        forma_pago: forma,
        notas,
      });
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Compensación guardada");
      setOpen(false);
      router.refresh();
    });
  }

  function clear() {
    if (!confirm("¿Quitar override y volver a usar el default del puesto?")) return;
    start(async () => {
      const res = await clearCompensation(userId);
      if (res?.error) {
        toast.error("No se pudo: " + res.error);
        return;
      }
      toast.success("Override eliminado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compensación · {userName}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Si dejás esto en blanco, hereda el default del puesto.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAY_FREQUENCY_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Forma de pago</Label>
          <Input
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            placeholder="Transferencia, CBU, alias, etc."
          />
        </div>
        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {current ? (
            <Button variant="outline" onClick={clear} disabled={pending}>
              Quitar override
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
