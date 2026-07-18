"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { markNoticeRead } from "@/app/(app)/portal/actions";

/**
 * Card de "Mi día": avisos importantes del Portal sin leer. Quedan acá hasta
 * que la persona los marca como leídos.
 */
export function DashboardAvisos({
  avisos,
}: {
  avisos: { id: string; titulo: string; cuerpo: string }[];
}) {
  const [, startTransition] = useTransition();
  if (avisos.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          📣 Avisos importantes de dirección
        </h2>
        <Link
          href="/portal"
          className="text-xs text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
        >
          Ver el Portal →
        </Link>
      </div>
      <div className="space-y-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-amber-200 bg-white/70 p-2.5 dark:border-amber-900/40 dark:bg-transparent"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold">{a.titulo}</div>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-foreground/80">
                {a.cuerpo}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const r = await markNoticeRead(a.id);
                  if (!r.ok) toast.error(r.error);
                })
              }
              className="shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-200"
            >
              ✓ Leído
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
