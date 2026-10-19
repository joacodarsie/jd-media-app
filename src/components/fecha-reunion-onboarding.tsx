"use client";

/**
 * «Reunión de onboarding» en cada arranque (19/10/2026, pedido de Luz): se
 * elige el día y el arranque pasa a contarse desde ahí.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { marcarReunionOnboarding } from "@/app/(app)/onboarding/actions";

export function FechaReunionOnboarding({ clienteId, fecha, marcada }: { clienteId: string; fecha: string; marcada: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(fecha);
  const [guardando, setGuardando] = useState(false);

  async function guardar(nueva: string) {
    setValor(nueva);
    if (!nueva || nueva === fecha) return;
    setGuardando(true);
    const r = await marcarReunionOnboarding(clienteId, nueva);
    setGuardando(false);
    if ("error" in r && r.error) {
      setValor(fecha);
      return void toast.error(r.error);
    }
    toast.success(
      r.corridos ? `Listo: el arranque cuenta desde ese día (corrimos ${r.corridos} paso${r.corridos === 1 ? "" : "s"}).` : "Listo: el arranque cuenta desde ese día."
    );
    router.refresh();
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
      onClick={(e) => e.stopPropagation()}
      title="El día 1 del arranque. Al cambiarlo, los pasos pendientes se corren."
    >
      {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className="text-muted-foreground">{marcada ? "Reunión de onboarding" : "¿Cuándo es la reunión de onboarding?"}</span>
      <input
        type="date"
        value={valor}
        onChange={(e) => guardar(e.target.value)}
        className="bg-transparent font-medium outline-none [color-scheme:light] dark:[color-scheme:dark]"
      />
    </label>
  );
}
