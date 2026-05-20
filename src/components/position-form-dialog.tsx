"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPosition,
  updatePosition,
  type PositionInput,
} from "@/app/(app)/equipo/actions";
import { AREAS, PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { Position, PositionTool } from "@/lib/types";
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

export function PositionFormDialog({
  mode,
  position,
  trigger,
}: {
  mode: "create" | "edit";
  position?: Position;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [nombre, setNombre] = useState(position?.nombre ?? "");
  const [area, setArea] = useState<string>(position?.area ?? "Creativas");
  const [descripcion, setDescripcion] = useState(position?.descripcion ?? "");
  const [aIncluye, setAIncluye] = useState(position?.alcance_incluye ?? "");
  const [aExcluye, setAExcluye] = useState(position?.alcance_excluye ?? "");
  const [tools, setTools] = useState<PositionTool[]>(position?.herramientas ?? []);
  const [kpis, setKpis] = useState(position?.kpis ?? "");
  const [procesos, setProcesos] = useState(position?.procesos ?? "");
  const [monto, setMonto] = useState<string>(
    position?.pago_default_monto != null ? String(position.pago_default_monto) : ""
  );
  const [moneda, setMoneda] = useState<string>(position?.pago_default_moneda ?? "ARS");
  const [freq, setFreq] = useState<string>(position?.pago_default_frecuencia ?? "mensual");
  const [forma, setForma] = useState(position?.pago_default_forma ?? "");
  const [pagoNotas, setPagoNotas] = useState(position?.pago_default_notas ?? "");

  function addTool() {
    setTools([...tools, { nombre: "", url: "" }]);
  }
  function setTool(i: number, key: "nombre" | "url", val: string) {
    const copy = [...tools];
    copy[i] = { ...copy[i], [key]: val };
    setTools(copy);
  }
  function removeTool(i: number) {
    setTools(tools.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!nombre.trim()) {
      toast.error("Falta el nombre del puesto.");
      return;
    }
    const payload: PositionInput = {
      nombre,
      area,
      descripcion,
      alcance_incluye: aIncluye,
      alcance_excluye: aExcluye,
      herramientas: tools.filter((t) => t.nombre.trim()),
      kpis,
      procesos,
      pago_default_monto: monto ? Number(monto) : null,
      pago_default_moneda: moneda,
      pago_default_frecuencia: freq,
      pago_default_forma: forma,
      pago_default_notas: pagoNotas,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createPosition(payload)
          : await updatePosition(position!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success(mode === "create" ? "Puesto creado" : "Puesto actualizado");
      setOpen(false);
      router.refresh();
      if (mode === "create" && res.ok && "id" in res) {
        router.push(`/equipo/${res.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo puesto" : "Editar puesto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción (Markdown)</Label>
            <Textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Resumen del puesto en una frase + contexto."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Alcance: qué entra</Label>
              <Textarea
                rows={4}
                value={aIncluye}
                onChange={(e) => setAIncluye(e.target.value)}
                placeholder="- Tarea 1&#10;- Tarea 2"
              />
            </div>
            <div className="space-y-2">
              <Label>Alcance: qué NO entra</Label>
              <Textarea
                rows={4}
                value={aExcluye}
                onChange={(e) => setAExcluye(e.target.value)}
                placeholder="- Cosa que no es de este puesto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Herramientas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTool}>
                <Plus className="mr-1 h-3 w-3" /> Agregar
              </Button>
            </div>
            {tools.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin herramientas.</p>
            )}
            <div className="space-y-2">
              {tools.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Nombre (ej: Meta Ads)"
                    value={t.nombre}
                    onChange={(e) => setTool(i, "nombre", e.target.value)}
                  />
                  <Input
                    placeholder="URL (opcional)"
                    value={t.url ?? ""}
                    onChange={(e) => setTool(i, "url", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeTool(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>KPIs / objetivos (Markdown)</Label>
            <Textarea
              rows={3}
              value={kpis}
              onChange={(e) => setKpis(e.target.value)}
              placeholder="- CTR objetivo: 1.5%&#10;- Tiempo de respuesta..."
            />
          </div>

          <div className="space-y-2">
            <Label>Procesos / SOPs (Markdown)</Label>
            <Textarea
              rows={6}
              value={procesos}
              onChange={(e) => setProcesos(e.target.value)}
              placeholder="## Proceso 1: …&#10;1. Paso 1&#10;2. Paso 2"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <h4 className="mb-2 text-sm font-semibold">Pago por defecto</h4>
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <Input
                  value={forma}
                  onChange={(e) => setForma(e.target.value)}
                  placeholder="Transferencia / PayPal / cripto / efectivo"
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={pagoNotas}
                  onChange={(e) => setPagoNotas(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
