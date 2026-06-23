"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCampaignEstado, deleteCampaign } from "@/app/(app)/prospeccion/actions";

export function ProspectingCampaignActions({
  id,
  estado,
  nombre,
}: {
  id: string;
  estado: string;
  nombre: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function togglePause() {
    const next = estado === "activa" ? "pausada" : "activa";
    start(async () => {
      const res = await setCampaignEstado(id, next);
      if ("error" in res) toast.error(res.error);
      else toast.success(next === "pausada" ? "Campaña pausada" : "Campaña reactivada");
    });
  }

  function remove() {
    if (!confirm(`¿Borrar la campaña "${nombre}" y todos sus leads?`)) return;
    start(async () => {
      const res = await deleteCampaign(id);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Campaña borrada");
      router.push("/prospeccion");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={togglePause} disabled={pending}>
        {estado === "activa" ? (
          <>
            <Pause className="mr-1 h-4 w-4" /> Pausar
          </>
        ) : (
          <>
            <Play className="mr-1 h-4 w-4" /> Reactivar
          </>
        )}
      </Button>
      <Button variant="ghost" size="icon" onClick={remove} disabled={pending} title="Borrar campaña">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
