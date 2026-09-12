"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Paneles flotantes que se pueden correr de lugar.
 *
 * Por qué existe: el asistente y la carga rápida viven clavados abajo a la
 * derecha y tapan el contenido justo cuando hacen falta —el dueño dijo que por
 * eso no los usó nunca—. Con esto se agarran del encabezado y se arrastran a
 * donde molesten menos, y ahí se quedan.
 *
 * La posición se guarda por panel en localStorage: es una comodidad de este
 * navegador, no un dato que tenga que viajar a ningún lado. Si el storage está
 * bloqueado (ventana privada, permisos), el panel funciona igual en su lugar de
 * siempre.
 */

interface Pos {
  x: number;
  y: number;
}

/** Cuánto del panel tiene que quedar siempre visible, para no perderlo de vista. */
const MARGEN = 48;

function leer(key: string): Pos | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

function guardar(key: string, pos: Pos | null) {
  try {
    if (pos) window.localStorage.setItem(key, JSON.stringify(pos));
    else window.localStorage.removeItem(key);
  } catch {
    /* sin storage el panel anda igual, solo no recuerda dónde quedó */
  }
}

export function usePanelArrastrable(storageKey: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // Al montar, recuperar dónde lo había dejado.
  useEffect(() => {
    const guardada = leer(storageKey);
    if (guardada) setPos(guardada);
  }, [storageKey]);

  /**
   * Que el panel no quede fuera de la pantalla. Pasa al cambiar de monitor, al
   * rotar el teléfono o al achicar la ventana: sin esto el panel desaparece y no
   * hay forma de traerlo de vuelta.
   */
  const acomodar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setPos((p) => {
      if (p.x === 0 && p.y === 0) return p;
      const r = el.getBoundingClientRect();
      // Cuánto se puede mover sin que se escape: el desplazamiento es relativo
      // a su posición natural (abajo a la derecha).
      const maxX = 0;
      const minX = -(window.innerWidth - MARGEN);
      const maxY = 0;
      const minY = -(window.innerHeight - MARGEN);
      const x = Math.min(maxX, Math.max(minX, p.x));
      const y = Math.min(maxY, Math.max(minY, p.y));
      // Si quedó tapado por arriba (el panel es más alto que lo que queda),
      // devolverlo a su lugar.
      if (r.top < 0 && y >= p.y) return { x, y: 0 };
      return x === p.x && y === p.y ? p : { x, y };
    });
  }, []);

  useEffect(() => {
    window.addEventListener("resize", acomodar);
    return () => window.removeEventListener("resize", acomodar);
  }, [acomodar]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Que arrastrar el encabezado no dispare el botón de cerrar ni seleccione
      // texto: si el click salió de un control, no es un arrastre.
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
      inicio.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
      setArrastrando(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const i = inicio.current;
      if (!i) return;
      setPos({ x: i.x + (e.clientX - i.px), y: i.y + (e.clientY - i.py) });
    },
    []
  );

  const terminar = useCallback(
    (e: React.PointerEvent) => {
      if (!inicio.current) return;
      inicio.current = null;
      setArrastrando(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* el navegador ya lo soltó */
      }
      acomodar();
      setPos((p) => {
        guardar(storageKey, p.x === 0 && p.y === 0 ? null : p);
        return p;
      });
    },
    [acomodar, storageKey]
  );

  const volver = useCallback(() => {
    setPos({ x: 0, y: 0 });
    guardar(storageKey, null);
  }, [storageKey]);

  return {
    /** Va en el contenedor del panel. */
    ref,
    /** Estilo del panel: lo corre sin tocar su posición original. */
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` } as React.CSSProperties,
    /** Se esparce sobre el encabezado que hace de manija. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: terminar,
      onPointerCancel: terminar,
      style: {
        cursor: arrastrando ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: arrastrando ? ("none" as const) : undefined,
      },
    },
    arrastrando,
    /** true si el panel no está en su lugar original. */
    movido: pos.x !== 0 || pos.y !== 0,
    /** Lo devuelve a la esquina. */
    volver,
  };
}
