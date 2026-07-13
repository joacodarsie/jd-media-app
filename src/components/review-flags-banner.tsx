"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { approveReviewFlag } from "@/app/(app)/review-actions";

export interface ReviewFlagRow {
  id: string;
  ruta: string;
  label: string;
  nota: string | null;
}

/**
 * Aura "sin testear": banner amarillo que aparece (solo a admins) en las rutas
 * con features nuevas todavía no aprobadas por el dueño. "Aprobar" la limpia.
 * El match es por prefijo: un flag en /finanzas/panorama también cubre sus
 * subrutas.
 */
export function ReviewFlagsBanner({ flags }: { flags: ReviewFlagRow[] }) {
  const pathname = usePathname();
  const [done, setDone] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const active = flags.filter(
    (f) =>
      !done.includes(f.id) &&
      (pathname === f.ruta || pathname.startsWith(`${f.ruta}/`))
  );
  if (active.length === 0) return null;

  function approve(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const res = await approveReviewFlag(id);
      if (res.ok) setDone((d) => [...d, id]);
      setPendingId(null);
    });
  }

  return (
    <div className="mb-4 space-y-2">
      {active.map((f) => (
        <div
          key={f.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Sin testear
          </span>
          <span className="font-medium">{f.label}</span>
          {f.nota && (
            <span className="text-xs text-amber-800/80 dark:text-amber-300/80">
              {f.nota}
            </span>
          )}
          <button
            type="button"
            onClick={() => approve(f.id)}
            disabled={pendingId === f.id}
            className="ml-auto shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/30"
          >
            {pendingId === f.id ? "Aprobando…" : "✓ Aprobar"}
          </button>
        </div>
      ))}
    </div>
  );
}
