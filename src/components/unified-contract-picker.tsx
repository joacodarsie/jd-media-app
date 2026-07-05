"use client";

import { useState } from "react";
import { FileText, Users, ChevronDown } from "lucide-react";

interface OtherClient {
  id: string;
  nombre: string;
  /** true si comparte el teléfono del titular (sugerida). */
  sameTitular: boolean;
  /** true si la cuenta está en estado "propuesta" (todavía no activada). */
  esPropuesta?: boolean;
}

/**
 * Selector manual de cuentas para la carta acuerdo UNIFICADA. El admin tilda
 * las otras marcas del mismo titular (las que comparten teléfono vienen
 * pre-tildadas como sugerencia) y genera una sola carta con todas.
 */
export function UnifiedContractPicker({
  currentId,
  others,
}: {
  currentId: string;
  others: OtherClient[];
}) {
  const suggested = others.filter((o) => o.sameTitular).map((o) => o.id);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(suggested));

  if (others.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ids = [currentId, ...others.filter((o) => selected.has(o.id)).map((o) => o.id)];
  const href = `/contrato/unificado?ids=${ids.join(",")}`;
  const count = selected.size;

  return (
    <div className="mt-3 rounded-lg border bg-muted/20 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Users className="h-3.5 w-3.5" /> Carta acuerdo unificada
          <span className="font-normal text-muted-foreground">
            · mismo titular, varias marcas
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Tildá las otras cuentas que pertenecen al mismo titular. Se genera{" "}
            <b>una sola carta</b> con el alcance de cada marca y el total
            combinado. Esta cuenta va incluida y define las condiciones comunes
            (nº, fecha, plazo).
          </p>

          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border bg-card p-1">
            {others.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 accent-[#FFD400]"
                />
                <span className="flex-1 truncate">{o.nombre}</span>
                {o.esPropuesta && (
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    propuesta
                  </span>
                )}
                {o.sameTitular && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    mismo teléfono
                  </span>
                )}
              </label>
            ))}
          </div>

          {count === 0 ? (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-muted-foreground opacity-60"
            >
              <FileText className="h-3.5 w-3.5" /> Elegí al menos una cuenta
            </button>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FFD400] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[#FFF7CC] dark:hover:bg-[#FFD400]/10"
            >
              <FileText className="h-3.5 w-3.5" /> Ver carta unificada ({count + 1}{" "}
              marcas)
            </a>
          )}
        </div>
      )}
    </div>
  );
}
