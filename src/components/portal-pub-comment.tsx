"use client";

import { useState } from "react";

/**
 * Affordance compacto para que el cliente deje un comentario sobre una pieza
 * del calendario (cualquier estado, no solo las que están en revisión).
 * Reusa el endpoint público /api/c/[token]/feedback con tipo "comentar".
 */
export function PortalPubComment({
  pubId,
  token,
}: {
  pubId: string;
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!mensaje.trim()) return;
    setError(null);
    setState("sending");
    try {
      const res = await fetch(`/api/c/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: pubId,
          tipo: "comentar",
          mensaje: mensaje.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Algo no salió bien");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Error de conexión");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div style={{ marginTop: 8, fontSize: 12, color: "#059669", fontWeight: 600 }}>
        ✓ Comentario enviado al equipo
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 8,
          fontSize: 11,
          fontWeight: 600,
          color: "#555",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        💬 Comentar
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={2}
        placeholder="Tu comentario para el equipo…"
        className="w-full rounded-md border p-2 text-xs"
        style={{ borderColor: "#d1d5db" }}
      />
      {error && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#b91c1c" }}>{error}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={send}
          disabled={state === "sending" || !mensaje.trim()}
          className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: "#1a1a1a", color: "#FFD400" }}
        >
          {state === "sending" ? "Enviando…" : "Enviar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMensaje("");
            setError(null);
          }}
          className="rounded-full px-3 py-1.5 text-xs font-medium"
          style={{ color: "#777" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
