import { cn } from "@/lib/utils";

/**
 * La carita de una persona del equipo (21/10/2026): su foto de perfil si la
 * subió; si no, la inicial. Antes las fichas mostraban siempre la inicial
 * aunque la persona tuviera foto.
 */
export function CaraPersona({
  nombre,
  url,
  className,
}: {
  nombre: string;
  url?: string | null;
  className?: string;
}) {
  const base = "flex shrink-0 items-center justify-center rounded-full font-semibold";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} className={cn(base, "bg-muted object-cover", className)} loading="lazy" />;
  }
  return <div className={cn(base, "bg-muted", className)}>{nombre.charAt(0)}</div>;
}
