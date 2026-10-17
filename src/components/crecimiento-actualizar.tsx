"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Saca la foto del Instagram en el momento, sin esperar al cron de la noche. */
export function CrecimientoActualizar({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "sacando" | "error">("listo");
  const [aviso, setAviso] = useState<string | null>(null);

  async function sacar() {
    setEstado("sacando");
    setAviso(null);
    try {
      const res = await fetch(`/api/cron/fotos-cuentas?cliente=${clienteId}`);
      const r = (await res.json()) as { procesadas?: { fotos: string[] }[]; noDisponibles?: string[]; errores?: { error: string }[] };
      if (r.noDisponibles?.length) setAviso("Instagram no deja leer la cuenta: tiene que ser pública y de empresa o creador.");
      else if (r.errores?.length) setAviso("No se pudo sacar la foto ahora. Probá en un rato.");
      else if (!r.procesadas?.length) setAviso("Ya está al día: la próxima foto sale sola en unas semanas.");
      setEstado("listo");
      router.refresh();
    } catch {
      setEstado("error");
      setAviso("No se pudo sacar la foto ahora.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={sacar} disabled={estado === "sacando"}>
        {estado === "sacando" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
        {estado === "sacando" ? "Sacando la foto…" : "Sacar foto ahora"}
      </Button>
      {aviso && <span className="max-w-xs text-right text-xs text-muted-foreground">{aviso}</span>}
    </div>
  );
}
