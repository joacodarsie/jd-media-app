"use client";

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

const NONE = "__none__";

/**
 * «¿De dónde vino?» (0191). Si es un referido, pide quién lo recomendó: es lo
 * que permite agradecerle y, más adelante, armar un incentivo por referidos.
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
          placeholder={origen === "referido" ? "¿Quién lo recomendó?" : "¿De dónde?"}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Para saber qué canal trae clientes y dónde conviene invertir.
      </p>
    </div>
  );
}
