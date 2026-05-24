"use client";

import { useTransition } from "react";
import { Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assignContractNumber } from "@/app/(app)/clientes/[id]/onboarding/actions";

export function AssignContractNumberButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await assignContractNumber(clientId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("numero" in res && res.numero) {
        toast.success(`Número asignado: ${res.numero}`);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Hash className="mr-1 h-4 w-4" />}
      Asignar nº de contrato
    </Button>
  );
}
