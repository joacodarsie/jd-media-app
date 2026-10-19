"use client";

/**
 * «Tu reunión del mes» en el portal (19/10/2026): el cliente elige día y hora
 * de su reunión mensual. Primero el día (chips), después la hora.
 */
import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { etiquetaTurno, type Turno } from "@/lib/retencion/reunion-autoagenda";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function PortalReunion({
  token,
  turnos,
  agendada,
}: {
  token: string;
  turnos: Turno[];
  agendada: string | null;
}) {
  const dias = useMemo(() => [...new Set(turnos.map((t) => t.dia))], [turnos]);
  const [dia, setDia] = useState<string | null>(dias[0] ?? null);
  const [listo, setListo] = useState<string | null>(agendada);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(t: Turno) {
    setEnviando(t.inicio);
    setError(null);
    try {
      const r = await fetch(`/api/c/${token}/reunion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: t.inicio }),
      });
      const j = (await r.json().catch(() => ({}))) as { etiqueta?: string; error?: string };
      if (!r.ok || !j.etiqueta) throw new Error(j.error ?? "No pudimos agendarla.");
      setListo(j.etiqueta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos agendarla. Probá de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  if (listo) {
    return (
      <div className="pr-listo">
        <span className="pr-check"><Check size={18} /></span>
        <div>
          <b>Agendada para el {listo}.</b>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Te mandamos el link de la videollamada antes.</div>
        </div>
      </div>
    );
  }
  if (!dias.length) return <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Esta semana no quedan horarios: te escribimos para coordinarla.</p>;

  return (
    <div>
      <div className="pr-dias">
        {dias.map((d) => {
          const w = new Date(`${d}T12:00:00Z`).getUTCDay();
          return (
            <button key={d} type="button" className={`pr-dia${d === dia ? " pr-activo" : ""}`} onClick={() => setDia(d)}>
              <span>{DIAS[w]}</span>
              <b>{Number(d.slice(8, 10))}</b>
            </button>
          );
        })}
      </div>
      <div className="pr-horas" key={dia}>
        {turnos
          .filter((t) => t.dia === dia)
          .map((t, i) => (
            <button
              key={t.inicio}
              type="button"
              className="pr-hora"
              style={{ animationDelay: `${i * 40}ms` }}
              disabled={!!enviando}
              onClick={() => elegir(t)}
              aria-label={etiquetaTurno(t)}
            >
              {enviando === t.inicio ? <Loader2 size={14} className="pr-gira" /> : `${t.hora}:00`}
            </button>
          ))}
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}
