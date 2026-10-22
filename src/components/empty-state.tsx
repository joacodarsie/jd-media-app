import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Ilustracion, type Escena } from "@/components/ilustracion";

/**
 * Estado vacío con CTA. Para usar cuando una lista no tiene resultados.
 * Mejor que un texto plano "sin tareas" — guía al usuario a la siguiente accion.
 */
export function EmptyState({
  icon: Icon,
  escena,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  /** Un dibujito en lugar del ícono (components/ilustracion). */
  escena?: Escena;
  title: string;
  description?: string;
  action?:
    | { type: "link"; href: string; label: string }
    | { type: "node"; node: React.ReactNode };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted/30 px-6 py-12 text-center animate-in fade-in zoom-in-95 duration-300",
        className
      )}
    >
      {escena ? <Ilustracion escena={escena} /> : Icon && (
        <div className="jd-flota flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action?.type === "link" && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {action.label}
        </Link>
      )}
      {action?.type === "node" && action.node}
    </div>
  );
}
