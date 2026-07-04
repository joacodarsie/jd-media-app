"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Dispara la búsqueda de leads con IA (búsqueda web) para una campaña. Puede
 * tardar entre 20 y 60 segundos: la IA navega y verifica antes de devolver.
 */
export function ProspectingDiscoverButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cantidad, setCantidad] = useState("20");

  async function run() {
    setLoading(true);
    const t = toast.loading(
      "Buscando empresas reales… busca en varias tandas, puede tardar 2-3 min."
    );
    try {
      const res = await fetch(`/api/prospeccion/${campaignId}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: Number(cantidad) }),
      });
      const data = (await res.json()) as {
        created?: number;
        skipped?: number;
        conMensaje?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo completar la búsqueda.", { id: t });
        return;
      }
      if ((data.created ?? 0) === 0) {
        toast.info(data.message ?? "No se sumaron leads nuevos.", { id: t });
      } else {
        const dup = data.skipped ? ` (${data.skipped} ya estaban)` : "";
        const msg = data.conMensaje
          ? ` con mensaje listo${data.conMensaje < (data.created ?? 0) ? ` (${data.conMensaje}/${data.created})` : ""}`
          : "";
        toast.success(`Se sumaron ${data.created} leads${msg}${dup}.`, { id: t });
      }
      router.refresh();
    } catch {
      toast.error("Error de red al buscar. Probá de nuevo.", { id: t });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={cantidad} onValueChange={setCantidad} disabled={loading}>
        <SelectTrigger className="w-[72px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["6", "10", "15", "20"].map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={run} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Buscar leads con IA
      </Button>
    </div>
  );
}
