"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { pedirACoordinador } from "@/app/(app)/direccion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "Pedirle algo": una línea y una fecha, y queda como tarea suya. */
export function PedirACoordinador({ personaId, nombre }: { personaId: string; nombre: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const enUnaSemana = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("sv-SE");
  const [fecha, setFecha] = useState(enUnaSemana);
  const [pending, start] = useTransition();

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Pedirle algo a {nombre}
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué le pedís"
        className="h-8 min-w-[180px] flex-1 text-xs"
      />
      <Input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="h-8 w-[140px] text-xs"
      />
      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await pedirACoordinador(personaId, texto, fecha);
            if ("error" in r && r.error) return void toast.error(r.error);
            toast.success(`Pedido a ${nombre}`);
            setTexto("");
            setAbierto(false);
            router.refresh();
          })
        }
      >
        Pedir
      </Button>
    </div>
  );
}
