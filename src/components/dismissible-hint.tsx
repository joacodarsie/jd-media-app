"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Caja de ayuda/explicación que el usuario puede ocultar para siempre con la
 * "×". La preferencia se guarda en localStorage por `id`, así cada persona
 * decide: útil para alguien nuevo, sin estorbar al equipo veterano.
 */
export function DismissibleHint({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const storageKey = `jd:hint-dismissed:${id}`;
  // Arranca visible (coincide con el render del server) y se oculta tras montar
  // si ya estaba descartada: evita mismatch de hidratación.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setDismissed(true);
    } catch {
      /* localStorage no disponible: la dejamos visible */
    }
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Ocultar esta ayuda"
        onClick={() => {
          try {
            localStorage.setItem(storageKey, "1");
          } catch {
            /* noop */
          }
          setDismissed(true);
        }}
        className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="pr-6">{children}</div>
    </div>
  );
}
