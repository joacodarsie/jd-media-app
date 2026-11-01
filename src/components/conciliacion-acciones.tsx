"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmar, deshacer } from "@/app/(app)/finanzas/conciliacion/actions";

/** Los dos botones de cada movimiento detectado por la planilla. */
export function ConciliacionAcciones({ clave, estado }: { clave: string; estado: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const correr = (fn: () => Promise<{ error?: string } | { ok: true }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ("error" in r && r.error) toast.error(r.error);
      else toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex shrink-0 gap-1.5">
      <Button size="sm" variant="outline" className="h-8 gap-1" disabled={pending} onClick={() => correr(() => confirmar(clave), "Listo.")}>
        <Check className="h-3.5 w-3.5" /> {estado === "marcado" ? "Está bien" : "Ya lo resolví"}
      </Button>
      {estado === "marcado" && (
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={pending} onClick={() => correr(() => deshacer(clave), "Deshecho: volvió como estaba.")}>
          <Undo2 className="h-3.5 w-3.5" /> No era esto
        </Button>
      )}
    </div>
  );
}
