"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshIgResults } from "@/app/(app)/clientes/[id]/resultados/actions";

export function IgRefreshButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function refresh() {
    start(async () => {
      const res = await refreshIgResults(clientId);
      if ("error" in res) return void toast.error(res.error);
      toast.success(`Actualizado: ${res.followers.toLocaleString("es-AR")} seguidores.`);
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={refresh} disabled={pending} className="h-9 gap-1.5">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Actualizar ahora
    </Button>
  );
}
