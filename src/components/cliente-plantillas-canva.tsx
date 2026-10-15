"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, LayoutTemplate, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarPlantillasCanva } from "@/app/(app)/clientes/actions";

/**
 * Las plantillas de Canva del cliente en su ficha (15/10/2026). Se pega el link
 * «Usar como plantilla» (Compartir → Más → Enlace de plantilla): el cliente se
 * lleva su propia copia y el original de la CM queda intacto. Aparece solo en
 * su portal.
 */
export function ClientePlantillasCanva({
  clienteId,
  url,
  puedeEditar,
}: {
  clienteId: string;
  url: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(url ?? "");
  const [pending, start] = useTransition();

  function guardar() {
    start(async () => {
      const r = await guardarPlantillasCanva(clienteId, valor);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(valor.trim() ? "Listo: el cliente ya ve sus plantillas en su plataforma." : "Plantillas quitadas.");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <LayoutTemplate className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Plantillas de Canva</h3>
        {url && puedeEditar && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Cambiar el link de las plantillas"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {url && !editando ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Abrir plantillas <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : puedeEditar ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Pegá el link de Canva <b>«Usar como plantilla»</b> (Compartir → Más → Enlace de plantilla). El cliente se
            lleva su propia copia y lo ve en su plataforma.
          </p>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="https://www.canva.com/design/…/view?mode=preview"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={guardar} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            {editando && (
              <Button size="sm" variant="ghost" onClick={() => { setEditando(false); setValor(url ?? ""); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Todavía no se cargaron.</p>
      )}
    </div>
  );
}
