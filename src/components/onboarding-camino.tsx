"use client";

import { useState } from "react";
import { Check, Flag, MapPin } from "lucide-react";
import {
  avanceDelCamino,
  caminoDePasos,
  pasoActual,
  puntosDelCamino,
} from "@/lib/onboarding/camino";
import { cn } from "@/lib/utils";

export interface PasoDelCamino {
  key: string;
  titulo: string;
  hecho: boolean;
  /** "12/09" o "Día 4": el dato chico que acompaña al nombre. */
  fecha?: string | null;
  /**
   * A dónde lleva el nodo. Por defecto baja al paso en la misma pantalla
   * (`#paso-<key>`); en el panorama de arranques lleva al ticket.
   */
  href?: string;
}

/**
 * El arranque de la cuenta como un mapa.
 *
 * Reemplaza al "0/13 pasos" para contestar de un vistazo por dónde va la
 * cuenta: los nodos hechos están pintados, el camino recorrido es una línea
 * llena y lo que falta queda punteado. El nodo del paso actual late.
 *
 * Tocar un nodo baja al paso en la lista de abajo, que es donde se trabaja: el
 * mapa es para mirar, no reemplaza a la lista. Antes había que leer trece
 * renglones para saber lo mismo.
 */
export function OnboardingCamino({
  pasos,
  columnas = 5,
}: {
  pasos: PasoDelCamino[];
  columnas?: number;
}) {
  const [encima, setEncima] = useState<number | null>(null);

  if (pasos.length === 0) return null;

  // Con pocos pasos, menos columnas: tres nodos en una grilla de cinco dejan
  // media pantalla vacía y el camino deja de parecer un camino.
  const camino = caminoDePasos(pasos.length, Math.min(pasos.length, columnas));
  const puntos = puntosDelCamino(camino);
  const hechos = pasos.map((p) => p.hecho);
  const avance = avanceDelCamino(hechos);
  const actual = pasoActual(hechos);
  const listos = hechos.filter(Boolean).length;
  const alturaFila = 96;

  // La línea se dibuja en dos tramos: lo recorrido y lo que falta. El tramo
  // recorrido incluye el punto siguiente para que la línea llegue hasta el
  // nodo en el que estamos parados, y no muera antes.
  const recorrido = puntos.slice(0, Math.max(avance, 1));
  const restante = puntos.slice(Math.max(avance - 1, 0));
  const aLinea = (ps: { x: number; y: number }[]) =>
    ps.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border bg-gradient-to-b from-muted/40 to-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {listos === pasos.length
            ? "Arranque completo 🎉"
            : actual !== null
            ? `Vas por: ${pasos[actual].titulo}`
            : "Sin empezar"}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {listos} de {pasos.length}
        </span>
      </div>

      <div
        className="relative w-full"
        style={{ height: camino.filas * alturaFila }}
      >
        {/* El camino. preserveAspectRatio="none" deja que el viewBox de 100×100
            se estire al tamaño real: los nodos usan los mismos porcentajes. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <polyline
            points={aLinea(restante)}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.8}
            strokeDasharray="2 2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/35"
            vectorEffect="non-scaling-stroke"
          />
          {avance > 1 && (
            <polyline
              points={aLinea(recorrido)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {camino.nodos.map((n) => {
          const paso = pasos[n.i];
          const esActual = n.i === actual;
          const esUltimo = n.i === pasos.length - 1;
          return (
            <a
              key={paso.key}
              href={paso.href ?? `#paso-${paso.key}`}
              onMouseEnter={() => setEncima(n.i)}
              onMouseLeave={() => setEncima(null)}
              onFocus={() => setEncima(n.i)}
              onBlur={() => setEncima(null)}
              title={paso.titulo}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-sm transition",
                  paso.hecho
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : esActual
                    ? "animate-pulse border-primary bg-card text-primary ring-4 ring-primary/20"
                    : "border-muted-foreground/25 bg-card text-muted-foreground"
                )}
              >
                {paso.hecho ? (
                  <Check className="h-5 w-5" />
                ) : esUltimo ? (
                  <Flag className="h-4 w-4" />
                ) : esActual ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  n.i + 1
                )}
              </span>

              {/* El nombre del paso: siempre el del actual, y el del nodo que
                  se está mirando. Mostrarlos todos convierte el mapa en la
                  misma lista de la que se venía. */}
              {(encima === n.i || (esActual && encima === null)) && (
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-36 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-center text-[11px] leading-tight shadow-md">
                  {paso.titulo}
                  {paso.hecho && paso.fecha && (
                    <span className="block text-[10px] text-muted-foreground">
                      {paso.fecha}
                    </span>
                  )}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
