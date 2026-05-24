"use client";

import { useState, useTransition } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveContractData } from "@/app/(app)/clientes/[id]/onboarding/contract-actions";

interface Initial {
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contrato_numero: string | null;
  contrato_fecha_inicio: string | null;
  contrato_plazo_meses: number | null;
  contrato_dia_cobro: number | null;
  contrato_moneda: string;
  contrato_descuento_pct: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

export function OnboardingContractForm({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Initial;
}) {
  const [form, setForm] = useState<Initial>(initial);
  const [pending, start] = useTransition();

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    start(async () => {
      const res = await saveContractData(clientId, form);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Datos guardados.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Nombre del contacto / firma</Label>
          <Input
            value={form.contacto_nombre ?? ""}
            onChange={(e) => set("contacto_nombre", e.target.value || null)}
            placeholder="Ej: Martín Torras"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">DNI o CUIT del contacto</Label>
          <Input
            value={form.contacto_dni_cuit ?? ""}
            onChange={(e) => set("contacto_dni_cuit", e.target.value || null)}
            placeholder="Ej: 37475138 o 20-37475138-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Domicilio del contacto</Label>
          <Input
            value={form.contacto_domicilio ?? ""}
            onChange={(e) => set("contacto_domicilio", e.target.value || null)}
            placeholder="Ej: Nazaret 3286, Córdoba"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Nº de contrato</Label>
          <Input
            value={form.contrato_numero ?? ""}
            onChange={(e) => set("contrato_numero", e.target.value || null)}
            placeholder="JD-2026-0001"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha de inicio</Label>
          <Input
            type="date"
            value={form.contrato_fecha_inicio ?? ""}
            onChange={(e) => set("contrato_fecha_inicio", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Plazo (meses)</Label>
          <Input
            type="number"
            min={1}
            value={form.contrato_plazo_meses ?? ""}
            onChange={(e) =>
              set("contrato_plazo_meses", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="3"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Día de cobro mensual</Label>
          <Input
            type="number"
            min={1}
            max={28}
            value={form.contrato_dia_cobro ?? ""}
            onChange={(e) =>
              set("contrato_dia_cobro", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Moneda</Label>
          <select
            value={form.contrato_moneda}
            onChange={(e) => set("contrato_moneda", e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Descuento promocional (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.contrato_descuento_pct ?? ""}
            onChange={(e) =>
              set("contrato_descuento_pct", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Ej: 50"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Por cuántos meses</Label>
          <Input
            type="number"
            min={0}
            value={form.contrato_descuento_meses ?? ""}
            onChange={(e) =>
              set("contrato_descuento_meses", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Ej: 3"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Observaciones (opcional)</Label>
        <Textarea
          value={form.contrato_observaciones ?? ""}
          onChange={(e) => set("contrato_observaciones", e.target.value || null)}
          placeholder="Cualquier cláusula o nota particular que quieras agregar al contrato."
          rows={3}
        />
      </div>

      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-1 h-4 w-4" />
        )}
        Guardar datos contractuales
      </Button>
    </div>
  );
}
