"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, PenLine } from "lucide-react";
import { changePublicationStatus } from "@/app/(app)/contenidos/actions";
import { Button } from "@/components/ui/button";

/**
 * Aprobar o pedir cambios, en un botón.
 *
 * Pedido del 13/9: que la aprobación esté a la vista en el posteo y no
 * escondida dentro de un select con nueve estados. Es la decisión que más se
 * toma sobre una pieza y la que traba la producción cuando no se toma: mientras
 * estuvo a dos clics de profundidad, había piezas esperando 19 y 20 días.
 *
 * Aprobar además deja la pieza en el Drive del cliente (lo hace la acción del
 * servidor), así que este botón es también el que se la entrega.
 */

/** Estados en los que la pieza está esperando una decisión. */
const ESPERANDO = ["revision_creativa", "revision_cliente", "en_diseno", "edicion", "guion"];

export function PublicationAprobacion({
  publicationId,
  estado,
}: {
  publicationId: string;
  estado: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pidiendo, setPidiendo] = useState(false);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState<"aprobar" | "cambios" | null>(null);

  if (!ESPERANDO.includes(estado)) return null;

  async function mandar(target: "aprobado" | "rechazado", notaFinal?: string) {
    setGuardando(target === "aprobado" ? "aprobar" : "cambios");
    const res = await changePublicationStatus(publicationId, target, notaFinal);
    setGuardando(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      target === "aprobado"
        ? "Aprobada. Va al Drive del cliente."
        : "Cambios pedidos. El equipo lo ve en la pieza."
    );
    setPidiendo(false);
    setNota("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium">Esta pieza está esperando una decisión</p>

      {!pidiendo ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => mandar("aprobado")}
            disabled={guardando !== null}
            className="gap-1.5"
          >
            {guardando === "aprobar" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPidiendo(true)}
            disabled={guardando !== null}
            className="gap-1.5"
          >
            <PenLine className="h-3.5 w-3.5" />
            Pedir cambios
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            autoFocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Qué hay que ajustar. Ej: cambiar el copy de la placa 1, el fondo más oscuro…"
            className="w-full rounded-md border bg-background p-2 text-xs"
            disabled={guardando !== null}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPidiendo(false);
                setNota("");
              }}
              disabled={guardando !== null}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <Button
              size="sm"
              onClick={() => {
                if (!nota.trim()) {
                  toast.error("Escribí qué hay que cambiar: sin eso el equipo no sabe qué hacer.");
                  return;
                }
                mandar("rechazado", nota);
              }}
              disabled={guardando !== null || !nota.trim()}
            >
              {guardando === "cambios" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Mandar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
