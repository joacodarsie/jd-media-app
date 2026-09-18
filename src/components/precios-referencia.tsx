"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { savePreciosReferencia } from "@/app/(app)/coordinacion/actions";
import type { PrecioReferencia } from "@/lib/coordinacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * La lista de precios de referencia.
 *
 * Desde el 18/9/2026 la web no publica precios: todo se cotiza a medida según
 * lo que necesita cada cliente. Esto es el "de cuánto partimos" para cotizar
 * rápido y comparar, y como esos números se mueven seguido, se editan acá
 * mismo en vez de estar en el código.
 */
export function PreciosReferencia({ initial }: { initial: PrecioReferencia[] }) {
  const [filas, setFilas] = useState<PrecioReferencia[]>(initial);
  const [sucio, setSucio] = useState(false);
  const [pending, start] = useTransition();

  const fmt = (n: number) => "$" + new Intl.NumberFormat("es-AR").format(n);

  function patch(i: number, cambio: Partial<PrecioReferencia>) {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
    setSucio(true);
  }

  function agregar() {
    setFilas((prev) => [
      ...prev,
      { id: `p_${Date.now()}`, nombre: "", precio: 0, nota: "" },
    ]);
    setSucio(true);
  }

  function borrar(i: number) {
    setFilas((prev) => prev.filter((_, j) => j !== i));
    setSucio(true);
  }

  function guardar() {
    const limpias = filas
      .filter((f) => f.nombre.trim())
      .map((f) => ({ ...f, nombre: f.nombre.trim(), nota: f.nota.trim() }));
    start(async () => {
      const res = await savePreciosReferencia(limpias);
      if (res?.error) return void toast.error("No se pudo guardar: " + res.error);
      setFilas(limpias);
      setSucio(false);
      toast.success("Precios guardados.");
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-base font-semibold">Precios de referencia</h2>
          <p className="text-xs text-muted-foreground">
            De cuánto partimos para cotizar. No se publican en la web: sirven para comparar
            rápido y armar una propuesta.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={agregar} disabled={pending}>
            <Plus className="mr-1.5 h-4 w-4" /> Agregar
          </Button>
          <Button size="sm" onClick={guardar} disabled={pending || !sucio}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {filas.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={f.nombre}
              onChange={(e) => patch(i, { nombre: e.target.value })}
              placeholder="Servicio"
              className="h-8 w-56 text-sm"
            />
            <Input
              type="number"
              value={f.precio}
              onChange={(e) => patch(i, { precio: Number(e.target.value) || 0 })}
              className="h-8 w-32 text-sm tabular-nums"
            />
            <span className="w-24 text-xs text-muted-foreground tabular-nums">
              {fmt(f.precio)}
            </span>
            <Input
              value={f.nota}
              onChange={(e) => patch(i, { nota: e.target.value })}
              placeholder="Qué incluye"
              className="h-8 min-w-[12rem] flex-1 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => borrar(i)}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {filas.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Todavía no hay precios cargados.
          </p>
        )}
      </div>
    </div>
  );
}
