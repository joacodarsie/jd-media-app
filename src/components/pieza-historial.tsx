"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { historialDePieza } from "@/app/(app)/contenidos/actions";
import { cn } from "@/lib/utils";

type Cambio = { texto: string; quien: string; cuando: string; tarde: boolean; dias: number | null };

/**
 * El historial de una pieza (30/10/2026): cada cambio de fecha y de etapa con
 * quién y cuándo. Se carga al abrirlo. Los cambios de último momento (a menos
 * de 48 h, o con la fecha ya pasada) van marcados.
 */
export function PiezaHistorial({ publicationId }: { publicationId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cambios, setCambios] = useState<Cambio[] | null>(null);
  const [pending, start] = useTransition();

  function alternar() {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir && cambios === null) {
      start(async () => {
        const r = await historialDePieza(publicationId);
        setCambios("cambios" in r && r.cambios ? r.cambios : []);
      });
    }
  }

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
      >
        <History className="h-4 w-4" /> Historial de cambios
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </button>
      {abierto && cambios && (
        cambios.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Todavía no hubo cambios de fecha ni de etapa desde que se lleva el registro (30/10/2026).</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {cambios.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", c.tarde ? "bg-red-500" : (c.dias ?? 0) > 0 ? "bg-amber-500" : "bg-muted-foreground/40")}
                  aria-hidden
                />
                <span>
                  <b className="font-medium">{c.quien}</b> · {c.texto}
                  {c.tarde && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">último momento</span>}
                  <span className="block text-muted-foreground">
                    {new Date(c.cuando).toLocaleString("es-AR", { timeZone: "America/Argentina/Cordoba", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
