import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Boton circular (?) para embeber al lado de titulos de seccion.
 * Linkea directo a la pagina del centro de ayuda correspondiente.
 *
 * Uso:
 *   <HelpTrigger slug="diagnostico" label="Cómo usar el diagnóstico" />
 */
export function HelpTrigger({
  slug,
  label,
  className,
  size = "sm",
}: {
  slug: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "md" ? "h-7 w-7" : "h-5 w-5";
  const iconCls = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <Link
      href={`/ayuda/${slug}`}
      title={label ?? "Cómo se usa"}
      aria-label={label ?? "Cómo se usa"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary",
        sizeCls,
        className
      )}
    >
      <HelpCircle className={iconCls} />
    </Link>
  );
}
