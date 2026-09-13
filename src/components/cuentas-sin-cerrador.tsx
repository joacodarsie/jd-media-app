"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asignarCerradores } from "@/app/(app)/coordinacion/comercial/cerrador-actions";

export interface CuentaSinCerrador {
  id: string;
  nombre: string;
  fechaInicio: string | null;
}

/**
 * Las cuentas activas que no dicen quién las cerró, para completarlas de una.
 *
 * De `cerrado_por_id` sale la comisión del comercial. Desde ahora el formulario
 * lo exige, pero las cuentas viejas quedaron sin el dato — y arreglarlas de a
 * una, entrando a la ficha de cada cliente, es exactamente lo que no se hace
 * nunca. Mismo criterio que las tareas sin fecha: el arreglo va donde se ve el
 * problema, y va en lote.
 */
export function CuentasSinCerrador({
  cuentas,
  comerciales,
}: {
  cuentas: CuentaSinCerrador[];
  comerciales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sel, setSel] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  if (cuentas.length === 0) return null;

  const elegidas = Object.entries(sel).filter(([, v]) => !!v);

  async function guardar() {
    if (elegidas.length === 0) return;
    setGuardando(true);
    const res = await asignarCerradores(
      elegidas.map(([clienteId, userId]) => ({ clienteId, userId }))
    );
    setGuardando(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${elegidas.length} cuenta${elegidas.length === 1 ? "" : "s"} con cerrador asignado.`
    );
    setSel({});
    startTransition(() => router.refresh());
  }

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/5">
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-amber-600" />
            {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"} activa
            {cuentas.length === 1 ? "" : "s"} sin cerrador
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            De este dato sale la comisión del comercial. Mientras esté vacío, esas cuentas
            no le cuentan a nadie.
          </p>
        </div>

        <div className="space-y-1.5">
          {cuentas.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{c.nombre}</span>
                {c.fechaInicio && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    desde {c.fechaInicio.slice(0, 7)}
                  </span>
                )}
              </div>
              <Select
                value={sel[c.id] ?? ""}
                onValueChange={(v) => setSel((p) => ({ ...p, [c.id]: v }))}
              >
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue placeholder="¿Quién la cerró?" />
                </SelectTrigger>
                <SelectContent>
                  {comerciales.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={guardar} disabled={guardando || elegidas.length === 0}>
            {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Guardar {elegidas.length > 0 ? `(${elegidas.length})` : ""}
          </Button>
          <p className="text-xs text-muted-foreground">
            Asignar el cerrador no genera comisión retroactiva: la comisión se calcula solo
            el primer mes de la cuenta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
