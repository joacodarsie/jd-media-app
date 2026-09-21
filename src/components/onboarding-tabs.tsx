import Link from "next/link";
import { hrefDePanel, type PanelDef, type PanelOnboarding } from "@/lib/onboarding/paneles";
import { cn } from "@/lib/utils";

/**
 * Las pestañas del onboarding de una cuenta.
 *
 * Existen para que la ficha del cliente pueda tener UN solo botón: se entra por
 * la pantalla que a cada uno le corresponde y desde ahí se llega al resto sin
 * volver atrás. Solo se muestran las que esa persona puede abrir — una pestaña
 * que rebota es peor que no tenerla.
 */
export function OnboardingTabs({
  clienteId,
  clienteNombre,
  paneles,
  actual,
}: {
  clienteId: string;
  clienteNombre?: string;
  paneles: PanelDef[];
  actual: PanelOnboarding;
}) {
  // Con una sola pantalla disponible no hay nada que elegir.
  if (paneles.length < 2) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
      {clienteNombre && (
        <span className="px-2 text-xs font-medium text-muted-foreground">
          {clienteNombre}
        </span>
      )}
      {paneles.map((p) => {
        const activo = p.key === actual;
        return (
          <Link
            key={p.key}
            href={hrefDePanel(clienteId, p.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
