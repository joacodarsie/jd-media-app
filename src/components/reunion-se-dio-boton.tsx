"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { registrarReunionMensual } from "@/app/(app)/clientes/actions";

/**
 * Una reunión agendada que pasó y nadie registró: en un clic se marca que se
 * dio (con el día que estaba agendada) o se va a la Agenda a reprogramarla.
 * Sin esto, una reunión dada figura como faltante y el tablero alarma de más.
 */
export function ReunionSeDioBoton({ clienteId, fecha }: { clienteId: string; fecha: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function seDio() {
    start(async () => {
      const r = await registrarReunionMensual({
        clienteId,
        periodo: fecha.slice(0, 7),
        fecha,
        notas: null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Reunión registrada");
      router.refresh();
    });
  }

  return (
    <span className="ml-4 mt-0.5 flex gap-2 text-xs">
      <button
        type="button"
        onClick={seDio}
        disabled={pending}
        className="rounded border px-1.5 py-0.5 font-medium hover:bg-accent disabled:opacity-50"
      >
        Se hizo
      </button>
      <Link href="/agenda" className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent">
        Reprogramar
      </Link>
    </span>
  );
}
