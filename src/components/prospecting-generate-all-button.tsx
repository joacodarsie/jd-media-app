"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAllMessages } from "@/app/(app)/prospeccion/actions";

/**
 * Genera de una el primer mensaje de todos los leads que todavía no lo tienen
 * (los que quedaron sin mensaje al descubrir o los cargados a mano).
 */
export function ProspectingGenerateAllButton({
  campaignId,
  count,
}: {
  campaignId: string;
  count: number;
}) {
  const [pending, start] = useTransition();

  function run() {
    const t = toast.loading(`Generando ${count} mensaje${count === 1 ? "" : "s"}…`);
    start(async () => {
      const res = await generateAllMessages(campaignId);
      if ("error" in res) return void toast.error(res.error, { id: t });
      toast.success(
        res.generated > 0
          ? `Listo: ${res.generated} mensaje${res.generated === 1 ? "" : "s"} generado${res.generated === 1 ? "" : "s"}.`
          : "No había mensajes para generar.",
        { id: t }
      );
    });
  }

  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Generar mensajes ({count})
    </Button>
  );
}
