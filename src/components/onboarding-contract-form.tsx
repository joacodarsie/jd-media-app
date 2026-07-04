"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  contrato_descuento_monto: number | null;
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
  const router = useRouter();

  // El nº de contrato se asigna desde un botón aparte (router.refresh()): cuando
  // cambia en el server, lo reflejamos en el form sin pisar los demás campos.
  useEffect(() => {
    setForm((f) =>
      f.contrato_numero === initial.contrato_numero
        ? f
        : { ...f, contrato_numero: initial.contrato_numero }
    );
  }, [initial.contrato_numero]);

  // Tipo de descuento: porcentaje o monto fijo. Se guarda uno u otro (el que no
  // se usa queda en null). Arranca según lo que ya venga cargado. Es estado
  // propio para no "saltar" a % mientras todavía no escribiste el monto.
  const [tipoDesc, setTipoDesc] = useState<"pct" | "monto">(
    initial.contrato_descuento_monto != null && initial.contrato_descuento_monto > 0
      ? "monto"
      : "pct"
  );

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
      router.refresh(); // refleja el nº de contrato en la carta sin recargar a mano
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

      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <Label className="text-xs font-semibold">Descuento promocional (opcional)</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <select
              value={tipoDesc}
              onChange={(e) => {
                const t = e.target.value as "pct" | "monto";
                setTipoDesc(t);
                // Al cambiar de tipo, limpiamos el valor del otro para no guardar
                // los dos a la vez.
                if (t === "monto") set("contrato_descuento_pct", null);
                else set("contrato_descuento_monto", null);
              }}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="pct">Porcentaje (%)</option>
              <option value="monto">Monto fijo ($)</option>
            </select>
          </div>
          {tipoDesc === "pct" ? (
            <div className="space-y-1">
              <Label className="text-xs">Descuento (%)</Label>
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
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Descuento ({form.contrato_moneda})</Label>
              <Input
                type="number"
                min={0}
                value={form.contrato_descuento_monto ?? ""}
                onChange={(e) =>
                  set("contrato_descuento_monto", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Ej: 30000"
              />
            </div>
          )}
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
        <p className="text-[11px] text-muted-foreground">
          Se aplica sobre el abono durante los primeros meses indicados. Elegí
          porcentaje o un monto fijo a descontar.
        </p>
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
