"use client";

/**
 * La racha de Mi día (19/10/2026): «🔥 N días al día». Cuando llega a un hito
 * (3, 5, 10…) lo festeja una sola vez con una lluvia de chispas.
 */
import { useEffect, useState } from "react";
import { HITOS_RACHA, proximoHito } from "@/lib/racha";
import { sonar } from "@/lib/sonido";

const CLAVE = "jd:racha-festejada";

export function RachaChip({ racha }: { racha: number }) {
  const [festejo, setFestejo] = useState(false);

  useEffect(() => {
    if (!HITOS_RACHA.includes(racha)) return;
    try {
      if (Number(localStorage.getItem(CLAVE) ?? 0) >= racha) return;
      localStorage.setItem(CLAVE, String(racha));
    } catch {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFestejo(true);
    sonar("hecha");
    const t = setTimeout(() => setFestejo(false), 2600);
    return () => clearTimeout(t);
  }, [racha]);

  const prox = proximoHito(racha);
  if (racha === 0) {
    return (
      <span className="jd-logro inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-black/5 backdrop-blur">
        🔥 Cerrá todo lo de hoy y arrancás una racha
      </span>
    );
  }
  return (
    <span
      className="jd-logro relative inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 px-2.5 py-1 text-xs font-bold text-orange-900 shadow-sm ring-1 ring-orange-300/50 dark:from-orange-500/20 dark:to-amber-500/20 dark:text-orange-200"
      title={prox ? `Te faltan ${prox - racha} para llegar a ${prox}` : "¡Imparable!"}
    >
      <span aria-hidden="true" className="jd-llama inline-block">🔥</span>
      {racha} {racha === 1 ? "día" : "días"} seguidos al día
      {festejo && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="jd-chispa absolute left-1/2 top-1/2 text-sm"
              style={{ "--ang": `${(i / 14) * 360}deg`, animationDelay: `${(i % 4) * 40}ms` } as React.CSSProperties}
            >
              {i % 3 === 0 ? "🔥" : i % 3 === 1 ? "✨" : "⭐"}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
