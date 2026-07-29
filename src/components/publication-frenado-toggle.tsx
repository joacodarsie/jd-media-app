"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hand, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPublicationFrenado } from "@/app/(app)/contenidos/actions";

/**
 * Marca una pieza como frenada POR EL CLIENTE. Sirve para que el semáforo no le
 * eche la culpa al equipo de un atraso que no es suyo: la pieza sale del conteo
 * de atraso y pasa a "esperando al cliente", que se reclama por otro lado.
 */
export function PublicationFrenadoToggle({
  publicationId,
  frenado,
  nota,
}: {
  publicationId: string;
  frenado: boolean;
  nota: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  function guardar(valor: boolean, motivo?: string) {
    start(async () => {
      const res = await setPublicationFrenado(publicationId, valor, motivo);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(
        valor ? "Marcada como frenada por el cliente" : "Ya no está frenada"
      );
      setAbierto(false);
      setTexto("");
      router.refresh();
    });
  }

  if (frenado) {
    return (
      <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/40">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="flex items-center gap-1.5 font-semibold text-sky-900 dark:text-sky-200">
              <Hand className="h-4 w-4" /> Frenada por el cliente
            </h4>
            {nota && (
              <p className="mt-0.5 whitespace-pre-line text-sky-900/80 dark:text-sky-200/80">
                {nota}
              </p>
            )}
            <p className="mt-1 text-xs text-sky-900/70 dark:text-sky-200/70">
              No cuenta como atraso del equipo.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => guardar(false)}
            disabled={pending}
            className="shrink-0 gap-1 text-xs"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Quitar
          </Button>
        </div>
      </div>
    );
  }

  if (!abierto) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAbierto(true)}
        className="gap-1.5"
        title="Si el atraso es del cliente (no mandó material, pidió esperar), marcalo acá"
      >
        <Hand className="h-3.5 w-3.5" /> Lo frenó el cliente
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium">¿Por qué está frenada? (queda registrado)</p>
      <textarea
        rows={2}
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej: no mandó las fotos del local · pidió esperar hasta el lanzamiento"
        className="w-full rounded-md border bg-background p-2 text-xs"
        disabled={pending}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setTexto("");
          }}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <Button size="sm" onClick={() => guardar(true, texto)} disabled={pending} className="gap-1">
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          Marcar
        </Button>
      </div>
    </div>
  );
}
