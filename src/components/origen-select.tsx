"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORIGENES } from "@/lib/clientes/origen";
import { clientesQueRecomiendan } from "@/app/(app)/clientes/referidos-actions";

const NONE = "__none__";

/**
 * «¿De dónde vino?» (0191). Si es un referido, pide quién lo recomendó. Si
 * eligen un cliente de la lista, queda anotado solo para su 10% por recomendar
 * y el nuevo recibe el 10% de su primer mes (programa de referidos, 0198).
 */
export function OrigenSelect({
  origen,
  detalle,
  onOrigen,
  onDetalle,
}: {
  origen: string | null;
  detalle: string;
  onOrigen: (v: string | null) => void;
  onDetalle: (v: string) => void;
}) {
  const [clientes, setClientes] = useState<string[]>([]);
  useEffect(() => {
    if (origen !== "referido" || clientes.length) return;
    clientesQueRecomiendan().then(setClientes, () => setClientes([]));
  }, [origen, clientes.length]);
  const esCliente = origen === "referido" && clientes.some((c) => c.toLowerCase() === detalle.trim().toLowerCase());

  return (
    <div className="space-y-2">
      <Label>¿De dónde vino?</Label>
      <Select value={origen ?? NONE} onValueChange={(v) => onOrigen(v === NONE ? null : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Elegí" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin dato</SelectItem>
          {ORIGENES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(origen === "referido" || origen === "otro") && (
        <Input
          value={detalle}
          onChange={(e) => onDetalle(e.target.value)}
          placeholder={origen === "referido" ? "¿Quién lo recomendó? Si es un cliente, elegilo" : "¿De dónde?"}
          list={origen === "referido" ? "clientes-que-recomiendan" : undefined}
        />
      )}
      {origen === "referido" && (
        <datalist id="clientes-que-recomiendan">
          {clientes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}
      {esCliente && (
        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          Referido de un cliente: {detalle.trim()} gana un 10% de descuento cuando esta cuenta pague su 2.º mes, y
          esta cuenta tiene 10% en su primer mes.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Para saber qué canal trae clientes y dónde conviene invertir.
      </p>
    </div>
  );
}
