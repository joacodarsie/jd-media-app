"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PartyPopper,
} from "lucide-react";
import { DIAS_ONBOARDING } from "@/lib/retencion/onboarding-15";
import type { ArranqueEnCurso } from "@/lib/retencion/onboarding-panorama";
import { cn } from "@/lib/utils";

/**
 * Los arranques de todas las cuentas nuevas, en una pantalla.
 *
 * Cada cuenta es una línea de tiempo de 15 días: se ve en qué día va, qué
 * pasos ya se cumplieron y cuáles quedaron atrás. El desglose se abre adentro
 * de la misma fila — la idea es no tener que entrar a la ficha de cada cliente
 * para saber cómo viene el arranque, que es exactamente lo que nadie hacía.
 */
export function OnboardingPanorama({ filas }: { filas: ArranqueEnCurso[] }) {
  // La primera cuenta viene abierta: si todo arranca cerrado, la pantalla
  // parece un índice y hay que hacer un clic para ver cualquier cosa.
  const [abiertas, setAbiertas] = useState<Set<string>>(
    () => new Set(filas.length ? [filas[0].ticketId] : [])
  );

  function toggle(id: string) {
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <PartyPopper className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No hay ninguna cuenta arrancando.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cuando se active una cuenta nueva, su plan de {DIAS_ONBOARDING} días aparece acá solo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filas.map((f) => {
        const abierta = abiertas.has(f.ticketId);
        return (
          <section key={f.ticketId} className="rounded-xl border bg-card">
            <button
              onClick={() => toggle(f.ticketId)}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              {abierta ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{f.clienteNombre}</span>

              {f.terminado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> Arranque completo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Día {Math.min(f.diaActual, DIAS_ONBOARDING)} de {DIAS_ONBOARDING}
                </span>
              )}

              {f.atrasados > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> {f.atrasados} atrasado
                  {f.atrasados === 1 ? "" : "s"}
                </span>
              )}
              {f.vencido && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                  Se pasó de los {DIAS_ONBOARDING} días
                </span>
              )}

              <span className="ml-auto flex items-center gap-2">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-all",
                      f.terminado ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.round(f.pct * 100)}%` }}
                  />
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {f.hechos}/{f.total}
                </span>
              </span>
            </button>

            {abierta && (
              <div className="border-t">
                <LineaDeTiempo fila={f} />
                <ul className="divide-y">
                  {f.pasos.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
                    >
                      <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        Día {p.dia}
                      </span>
                      <span
                        className={cn(
                          "inline-block h-2 w-2 shrink-0 rounded-full",
                          p.hecho
                            ? "bg-emerald-500"
                            : p.atrasado
                            ? "bg-amber-500"
                            : "bg-muted-foreground/30"
                        )}
                      />
                      <Link
                        href={`/tareas/${p.id}`}
                        className={cn(
                          "min-w-0 flex-1 truncate hover:underline",
                          p.hecho && "text-muted-foreground line-through"
                        )}
                      >
                        {p.titulo}
                      </Link>
                      {p.area && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {p.area}
                        </span>
                      )}
                      {p.asignado_nombre && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {p.asignado_nombre.split(" ")[0]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 border-t px-4 py-2.5 text-xs">
                  <Link
                    href={`/clientes/${f.clienteId}/onboarding`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Checklist de datos y accesos <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    href={`/tareas/${f.ticketId}`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Abrir el ticket {f.numero ? `JD-${f.numero}` : ""}
                  </Link>
                  <Link
                    href={`/clientes/${f.clienteId}`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Ficha de la cuenta
                  </Link>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Los 15 días como una tira de casilleros. Es la forma más corta de contestar
 * "¿va bien o va tarde?" sin leer la lista de pasos.
 */
function LineaDeTiempo({ fila }: { fila: ArranqueEnCurso }) {
  const dias = Array.from({ length: DIAS_ONBOARDING }, (_, i) => i + 1);
  const porDia = new Map<number, { hechos: number; atrasados: number; total: number }>();
  for (const p of fila.pasos) {
    const d = Math.min(p.dia, DIAS_ONBOARDING);
    const v = porDia.get(d) ?? { hechos: 0, atrasados: 0, total: 0 };
    v.total += 1;
    if (p.hecho) v.hechos += 1;
    if (p.atrasado) v.atrasados += 1;
    porDia.set(d, v);
  }

  return (
    <div className="flex items-end gap-1 px-4 pb-1 pt-3">
      {dias.map((d) => {
        const v = porDia.get(d);
        const esHoy = d === Math.min(fila.diaActual, DIAS_ONBOARDING);
        const color = !v
          ? "bg-muted"
          : v.atrasados > 0
          ? "bg-amber-500"
          : v.hechos === v.total
          ? "bg-emerald-500"
          : "bg-primary/40";
        return (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <span
              title={
                v
                  ? `Día ${d}: ${v.hechos} de ${v.total} listos`
                  : `Día ${d}: sin pasos`
              }
              className={cn("h-2 w-full rounded-sm", color)}
            />
            <span
              className={cn(
                "text-[9px] tabular-nums",
                esHoy ? "font-semibold text-foreground" : "text-muted-foreground/60"
              )}
            >
              {d}
            </span>
          </div>
        );
      })}
    </div>
  );
}
