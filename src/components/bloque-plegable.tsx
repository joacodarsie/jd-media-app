"use client";

/**
 * Un bloque que se ve como una fila y se abre al tocarlo (24/10/2026, pedido
 * del dueño: «no quiero de una todos los detalles; si quiero más info, lo
 * abro»). Cerrado muestra lo mínimo: el ícono, el título, una línea de resumen
 * y, a la derecha, el número que importa. Si la página llega con #id (los
 * avisos llevan a /dashboard#congeladas, por ejemplo), ese bloque se abre solo.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function BloquePlegable({
  id,
  emoji,
  titulo,
  resumen,
  derecha,
  abierto = false,
  className,
  children,
}: {
  id?: string;
  emoji: ReactNode;
  titulo: ReactNode;
  resumen?: ReactNode;
  derecha?: ReactNode;
  abierto?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (id && window.location.hash === `#${id}` && ref.current) ref.current.open = true;
  }, [id]);
  return (
    <details
      ref={ref}
      id={id}
      open={abierto || undefined}
      className={cn("group scroll-mt-24 rounded-2xl border bg-card animate-in fade-in slide-in-from-bottom-2 duration-500", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-muted/40 md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-2xl" aria-hidden="true">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">{titulo}</h2>
          {resumen && <div className="mt-0.5 text-xs text-muted-foreground">{resumen}</div>}
        </div>
        {derecha && <div className="shrink-0">{derecha}</div>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 pb-4 pt-3 md:px-5">{children}</div>
    </details>
  );
}
