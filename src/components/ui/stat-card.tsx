// Celda de indicador (label + número + subtexto) para las grillas de stats de
// Finanzas/Coordinación. Vivía copiada con variaciones mínimas en el panel de
// Coordinación, el Panorama y el resumen de Sueldos; ahora es una sola.

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  tone,
  muted,
  strong,
  subCapitalize,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Verde (good), rojo (bad) o ámbar (warn) para el número. */
  tone?: "good" | "bad" | "warn";
  /** Número atenuado (costos que no son ni buenos ni malos). */
  muted?: boolean;
  /** Celda destacada (ej: el neto final). */
  strong?: boolean;
  /** Capitaliza el subtexto (ej: nombre del mes). */
  subCapitalize?: boolean;
}) {
  return (
    <div className={cn("bg-card p-3", strong && "bg-primary/5")}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-bold tabular-nums",
          strong ? "text-xl" : "text-lg",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
          tone === "warn" && "text-amber-600",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </div>
      {sub && (
        <div className={cn("text-[10px] text-muted-foreground", subCapitalize && "capitalize")}>
          {sub}
        </div>
      )}
    </div>
  );
}
