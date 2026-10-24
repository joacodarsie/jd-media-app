"use client";

/**
 * La lista de la limpieza de vencidas (24/10/2026): una fila por tarea con
 * tres botones. Lo que se resuelve sale de la lista al toque.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarArrowUp, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTicket } from "@/lib/tareas/tickets";
import { haceCuanto, type OpcionDePase } from "@/lib/tareas/limpieza";
import { limpiarTarea } from "@/app/(app)/tareas/limpieza/actions";

export interface TareaALimpiar {
  id: string;
  numero: number | null;
  titulo: string;
  cliente: string | null;
  dias: number;
}

export function LimpiezaVencidas({ tareas, opciones }: { tareas: TareaALimpiar[]; opciones: OpcionDePase[] }) {
  const router = useRouter();
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const quedan = tareas.filter((t) => !hechas.has(t.id));
  const total = tareas.length;

  if (!total)
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <div className="text-4xl" aria-hidden="true">🎉</div>
        <p className="mt-2 font-semibold">No tenés tareas vencidas.</p>
        <p className="text-sm text-muted-foreground">Tu lista está al día.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            {quedan.length ? (
              <>
                Te quedan <b>{quedan.length}</b>
              </>
            ) : (
              <b>¡Listo! Limpiaste las {total}.</b>
            )}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {hechas.size} de {total}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(hechas.size / total) * 100}%` }} />
        </div>
      </div>

      {quedan.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {quedan.map((t) => (
            <Fila
              key={t.id}
              t={t}
              opciones={opciones}
              onListo={() => {
                setHechas((s) => new Set(s).add(t.id));
                router.refresh();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({ t, opciones, onListo }: { t: TareaALimpiar; opciones: OpcionDePase[]; onListo: () => void }) {
  const [pending, start] = useTransition();
  const [pasando, setPasando] = useState(false);
  const [otra, setOtra] = useState("");
  const hacer = (accion: "hecha" | "pasar" | "no_va", fecha?: string, ok?: string) =>
    start(async () => {
      const r = await limpiarTarea(t.id, accion, fecha);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success((r as { aviso?: string }).aviso ?? ok ?? "Listo.");
      onListo();
    });

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link href={`/tareas/${t.id}`} className="block truncate text-sm font-medium hover:underline">
            {t.titulo}
          </Link>
          <div className="text-xs text-muted-foreground">
            {t.numero ? <span className="font-mono">{formatTicket(t.numero)} · </span> : null}
            {t.cliente ? `${t.cliente} · ` : ""}
            <span className={cn(t.dias > 14 && "text-red-600 dark:text-red-400")}>{haceCuanto(t.dias)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            type="button"
            disabled={pending}
            onClick={() => hacer("hecha", undefined, "Marcada como hecha.")}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Ya está
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPasando((v) => !v)}
            aria-expanded={pasando}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <CalendarArrowUp className="h-3.5 w-3.5" /> Pasala
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => hacer("no_va", undefined, "Archivada: ya no va.")}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Ya no va
          </button>
        </div>
      </div>
      {pasando && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/50 p-2">
          <span className="px-1 text-xs text-muted-foreground">Pasala a:</span>
          {opciones.map((o) => (
            <button
              key={o.label}
              type="button"
              disabled={pending}
              onClick={() => hacer("pasar", o.fecha, `Pasada al ${o.fecha.slice(8, 10)}/${o.fecha.slice(5, 7)}.`)}
              className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:border-primary disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
          <input
            type="date"
            value={otra}
            min={opciones[0]?.fecha}
            onChange={(e) => setOtra(e.target.value)}
            className="rounded-full border bg-background px-2 py-0.5 text-xs"
            aria-label="Otra fecha"
          />
          {otra && (
            <button
              type="button"
              disabled={pending}
              onClick={() => hacer("pasar", otra, `Pasada al ${otra.slice(8, 10)}/${otra.slice(5, 7)}.`)}
              className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Pasar
            </button>
          )}
        </div>
      )}
    </li>
  );
}
