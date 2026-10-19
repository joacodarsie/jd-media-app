"use client";

/**
 * La cuenta regresiva de la aprobación tácita en el portal (19/10/2026): cuánto
 * le queda al cliente para revisar antes de que las piezas se den por
 * aprobadas, como dice su carta acuerdo.
 */
import { useEffect, useState } from "react";

function falta(ms: number): string {
  if (ms <= 0) return "vencido";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d >= 1) return `${d} d ${h % 24} h`;
  if (h >= 1) return `${h} h ${m} min`;
  return `${m} min`;
}

export function PortalPlazo({ hastaIso, etiqueta }: { hastaIso: string; etiqueta: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const i = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const ms = ahora == null ? null : Date.parse(hastaIso) - ahora;
  const urgente = ms != null && ms < 24 * 3_600_000;
  return (
    <div className={`pz-caja${urgente ? " pz-urgente" : ""}`}>
      <div className="pz-reloj" aria-hidden="true">⏳</div>
      <div>
        <div className="pz-titulo">
          Tenés hasta {etiqueta}
          {ms != null && ms > 0 && <span className="pz-falta">faltan {falta(ms)}</span>}
        </div>
        <div className="pz-texto">
          Si para entonces no nos respondés, las piezas <b>se dan por aprobadas</b> y se publican en su fecha, como acordamos en tu
          carta acuerdo.
        </div>
      </div>
    </div>
  );
}
