"use client";

/**
 * Un número que «cuenta» hasta su valor cuando aparece (18/10/2026): las
 * cifras grandes se sienten vivas en vez de estar pegadas. Con «reducir
 * movimiento» del sistema, se muestra quieto.
 */
import { useEffect, useRef, useState } from "react";

export function NumeroVivo({
  valor,
  prefijo = "",
  sufijo = "",
  duracion = 900,
}: {
  valor: number;
  prefijo?: string;
  sufijo?: string;
  duracion?: number;
}) {
  // Arranca en 0 y cuenta: hidrata en milisegundos, no llega a verse quieto en 0.
  const [v, setV] = useState(0);
  const desde = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(valor);
      return;
    }
    const inicio = desde.current;
    const t0 = performance.now();
    let id = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(inicio + (valor - inicio) * e));
      if (k < 1) id = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, duracion]);

  return (
    <span className="tabular-nums">
      {prefijo}
      {v.toLocaleString("es-AR")}
      {sufijo}
    </span>
  );
}
