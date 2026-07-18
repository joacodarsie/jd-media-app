"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleClientPausa } from "@/app/(app)/clientes/actions";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function periodLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function shift(base: Date, months: number) {
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Pausar un mes puntual de la cuenta: ese mes no se cobra, no se paga al equipo
 * por esta cuenta y no cuenta en el panorama. La cuenta sigue activa.
 */
export function ClientPauseControl({
  id,
  pausas,
}: {
  id: string;
  pausas: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const now = new Date();
  // Ofrecemos pausar los próximos 4 meses (incluye el actual).
  const opciones = [0, 1, 2, 3].map((n) => shift(now, n));
  const activas = [...pausas].sort();

  function toggle(periodo: string) {
    start(async () => {
      const res = await toggleClientPausa(id, periodo);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.pausada
          ? `Pausada en ${periodLabel(periodo)}`
          : `Reactivada en ${periodLabel(periodo)}`
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <div className="mb-1 text-xs text-muted-foreground">Pausar un mes</div>
      <p className="mb-2 text-xs text-muted-foreground">
        El mes pausado no se cobra ni se le paga al equipo por esta cuenta. Sigue
        activa y retoma sola.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((p) => {
          const on = activas.includes(p);
          return (
            <button
              key={p}
              type="button"
              disabled={pending}
              onClick={() => toggle(p)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize disabled:opacity-50 ${
                on
                  ? "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  : "bg-background hover:bg-accent"
              }`}
            >
              {on ? "⏸ " : ""}
              {periodLabel(p)}
            </button>
          );
        })}
      </div>
      {activas.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Pausada:{" "}
          <b className="capitalize">{activas.map(periodLabel).join(" · ")}</b>
        </p>
      )}
    </div>
  );
}
