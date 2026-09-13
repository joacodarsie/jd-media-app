"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SectionTab } from "@/lib/section-tabs";

/**
 * Las pestañas de Finanzas.
 *
 * A diferencia de las otras secciones, Finanzas no tiene un único juego de
 * pestañas: tiene tres grupos que viven todos bajo `/finanzas` (más `/cobros`,
 * que está afuera). Por eso el grupo se elige acá, en el cliente, mirando la
 * ruta — un layout de servidor no puede saber en cuál de los tres estás.
 *
 * Solo se muestran las pestañas del grupo activo. Mostrar los tres juegos
 * juntos sería el menú de trece pantallas otra vez, con otra forma.
 */
export function FinanzasTabs({ grupos }: { grupos: SectionTab[][] }) {
  const pathname = usePathname();

  // Gana la pestaña cuyo href sea el prefijo más largo de la ruta actual: así
  // `/finanzas/cobros` no queda capturado por `/cobros`.
  let grupo: SectionTab[] | null = null;
  let mejor = -1;
  for (const g of grupos) {
    for (const t of g) {
      if ((pathname === t.href || pathname.startsWith(t.href + "/")) && t.href.length > mejor) {
        mejor = t.href.length;
        grupo = g;
      }
    }
  }
  if (!grupo) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b">
      {grupo.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
