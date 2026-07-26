"use client";

import { useState, useTransition } from "react";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { submitSatisfaction } from "@/app/encuesta/[token]/actions";

const CARAS: { valor: number; label: string }[] = [
  { valor: 1, label: "Muy mal" },
  { valor: 2, label: "Mal" },
  { valor: 3, label: "Bien" },
  { valor: 4, label: "Muy bien" },
  { valor: 5, label: "Excelente" },
];

/**
 * Encuesta de fin de mes que ve el CLIENTE (página pública, sin login). Corta y
 * sin fricción: una puntuación y dos preguntas abiertas opcionales.
 */
export function SatisfactionForm({
  token,
  yaRespondio,
  puntajePrevio,
}: {
  token: string;
  yaRespondio: boolean;
  puntajePrevio: number | null;
}) {
  const [puntaje, setPuntaje] = useState<number | null>(puntajePrevio);
  const [valoran, setValoran] = useState("");
  const [mejorar, setMejorar] = useState("");
  const [listo, setListo] = useState(yaRespondio);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (listo) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold">¡Gracias por tu respuesta!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La tenemos en cuenta para el mes que viene. Si querés agregar algo, escribinos
          cuando quieras.
        </p>
      </div>
    );
  }

  function enviar() {
    setError(null);
    if (puntaje == null) {
      setError("Elegí una puntuación para poder enviar.");
      return;
    }
    start(async () => {
      const res = await submitSatisfaction({
        token,
        puntaje,
        que_valoran: valoran,
        que_mejorar: mejorar,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setListo(true);
    });
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-6">
      <div>
        <label className="text-sm font-medium">
          ¿Cómo venimos este mes? <span className="text-rose-500">*</span>
        </label>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {CARAS.map((c) => {
            const activo = puntaje === c.valor;
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => setPuntaje(c.valor)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors ${
                  activo
                    ? "border-primary bg-primary/10"
                    : "hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <Star
                  className={`h-5 w-5 ${
                    activo ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  }`}
                />
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">¿Qué es lo que más te sirve?</label>
        <textarea
          rows={3}
          value={valoran}
          onChange={(e) => setValoran(e.target.value)}
          placeholder="Opcional"
          className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="text-sm font-medium">¿Qué podríamos mejorar?</label>
        <textarea
          rows={3}
          value={mejorar}
          onChange={(e) => setMejorar(e.target.value)}
          placeholder="Opcional, pero es lo que más nos sirve"
          className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <button
        onClick={enviar}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar
      </button>
    </div>
  );
}
