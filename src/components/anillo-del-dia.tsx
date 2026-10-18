"use client";

/**
 * El avance del día en Mi día (18/10/2026): un anillo que se llena con las
 * tareas que ya cerraste hoy sobre las que tenías para hoy (vencidas incluidas).
 * Al cerrar la última, un festejo corto, una sola vez por día.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COLORES = ["#ffd400", "#22c55e", "#3b82f6", "#f43f5e", "#a855f7", "#f97316"];

export function AnilloDelDia({ hechas, total, hoy }: { hechas: number; total: number; hoy: string }) {
  const pct = total > 0 ? Math.min(1, hechas / total) : 0;
  const completo = total > 0 && hechas >= total;
  const [lleno, setLleno] = useState(0);
  const [festejo, setFestejo] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLleno(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  useEffect(() => {
    if (!completo) return;
    const clave = `jd_dia_completo_${hoy}`;
    try {
      if (localStorage.getItem(clave)) return;
      localStorage.setItem(clave, "1");
    } catch {
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFestejo(true);
    const t = setTimeout(() => setFestejo(false), 2600);
    return () => clearTimeout(t);
  }, [completo, hoy]);

  if (total === 0 && hechas === 0) return null;
  const r = 22;
  const largo = 2 * Math.PI * r;

  return (
    <div className="relative flex items-center gap-3" title={`${hechas} de ${total} tareas de hoy hechas`}>
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={cn(completo ? "stroke-emerald-500" : "stroke-primary")}
          style={{
            strokeDasharray: largo,
            strokeDashoffset: largo * (1 - lleno),
            transition: "stroke-dashoffset 1s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </svg>
      <span className="absolute left-0 top-0 flex h-14 w-14 items-center justify-center text-xs font-bold tabular-nums">
        {completo ? "✓" : `${Math.round(pct * 100)}%`}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tabular-nums">
          {hechas} de {total}
        </div>
        <div className="text-xs text-muted-foreground">
          {completo ? "¡Día completo! 🎉" : hechas === 0 ? "Arrancá por la primera" : "Vas bien, seguí así"}
        </div>
      </div>
      {festejo && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 70 }).map((_, i) => (
            <span
              key={i}
              className="jd-papelito"
              style={{
                left: `${(i * 37) % 100}%`,
                background: COLORES[i % COLORES.length],
                animationDelay: `${(i % 14) * 45}ms`,
                animationDuration: `${1.6 + ((i * 13) % 10) / 10}s`,
                transform: `rotate(${(i * 47) % 360}deg)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
