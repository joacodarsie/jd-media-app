"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { cerrarPagosDelMes } from "@/app/(app)/finanzas/resumen/actions";

/**
 * El botón que cierra el mes desde el resumen.
 *
 * Pide confirmación con el monto adentro: es una afirmación sobre plata que
 * salió, y si se aprieta sin querer deja registrado un pago que no existió.
 */
export function CerrarPagosBoton({
  periodo,
  etiquetaMes,
  monto,
}: {
  periodo: string;
  etiquetaMes: string;
  monto: string;
}) {
  const [pendiente, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await cerrarPagosDelMes(periodo);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setConfirmando(false);
      }
      // Si salió bien no hace falta hacer nada: el revalidate vuelve a
      // renderizar la hoja sin el cartel.
    });
  }

  if (confirmando) {
    return (
      <div className="mt-3 rounded-lg border bg-background p-3 print:hidden">
        <p className="text-sm">
          Se va a registrar que <b>pagaste {monto}</b> de {etiquetaMes}: los sueldos del equipo y
          la estructura del mes. ¿Es así?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={confirmar}
            disabled={pendiente}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pendiente ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Sí, registrar
          </button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={pendiente}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 print:hidden"
    >
      <Check className="h-3.5 w-3.5" /> Ya pagué todo esto
    </button>
  );
}
