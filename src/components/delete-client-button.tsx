"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteClientRow } from "@/app/(app)/clientes/actions";
import { Button } from "@/components/ui/button";

export function DeleteClientButton({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handle() {
    if (!confirm(`¿Eliminar el cliente "${nombre}"? Las tareas quedan sin cliente.`)) return;
    start(async () => {
      const res = await deleteClientRow(id);
      if (res?.error) {
        toast.error("No se pudo eliminar: " + res.error);
        return;
      }
      toast.success("Cliente eliminado");
      router.push("/clientes");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={pending}>
      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
    </Button>
  );
}
