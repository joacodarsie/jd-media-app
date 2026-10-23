"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Check } from "lucide-react";
import { avisarCongeladas } from "@/app/(app)/contenidos/congeladas-actions";

/** «Avisar» a una persona por todas sus piezas congeladas, en un solo aviso. */
export function AvisarCongeladasBoton({ responsableId }: { responsableId: string }) {
  const [pending, start] = useTransition();
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      disabled={pending || hecho}
      onClick={() =>
        start(async () => {
          const r = await avisarCongeladas(responsableId);
          if ("error" in r) return void toast.error(r.error);
          setHecho(true);
          toast.success("Le llegó el aviso.");
        })
      }
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {hecho ? <Check className="h-3 w-3" /> : <Bell className="h-3 w-3" />} {hecho ? "Avisado" : "Avisar"}
    </button>
  );
}
