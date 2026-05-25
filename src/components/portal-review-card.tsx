"use client";

import { useState } from "react";

interface ReviewPub {
  id: string;
  titulo: string;
  copy: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  asset_url: string | null;
}

export function PortalReviewCard({ pub, token }: { pub: ReviewPub; token: string }) {
  const [mode, setMode] = useState<"idle" | "approve" | "request" | "comment" | "done" | "sending">("idle");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(tipo: "aprobar" | "rechazar" | "comentar") {
    setError(null);
    setMode("sending");
    try {
      const res = await fetch(`/api/c/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: pub.id,
          tipo,
          mensaje: mensaje.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Algo no salió bien");
        setMode(tipo === "aprobar" ? "approve" : tipo === "rechazar" ? "request" : "comment");
        return;
      }
      setMode("done");
    } catch {
      setError("Error de conexión");
      setMode(tipo === "aprobar" ? "approve" : tipo === "rechazar" ? "request" : "comment");
    }
  }

  if (mode === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="text-sm font-semibold text-emerald-900">¡Listo!</div>
        <div className="mt-1 text-xs text-emerald-800">
          Recibimos tu respuesta sobre &ldquo;{pub.titulo}&rdquo;. El equipo va a verla enseguida.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#ececec" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{pub.titulo}</div>
          <div className="mt-0.5 text-xs" style={{ color: "#777", textTransform: "capitalize" }}>
            {pub.tipo} · {pub.red}
            {pub.fecha_publicacion && ` · ${new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}`}
          </div>
        </div>
      </div>

      {pub.copy && (
        <div className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs leading-relaxed" style={{ color: "#444" }}>
          {pub.copy.length > 600 ? pub.copy.slice(0, 600) + "…" : pub.copy}
        </div>
      )}

      {pub.asset_url && (
        <a
          href={pub.asset_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-medium underline"
          style={{ color: "#1a1a1a" }}
        >
          Ver pieza adjunta →
        </a>
      )}

      {error && (
        <div className="mt-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</div>
      )}

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("approve")}
            className="rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: "#10b981", color: "white" }}
          >
            ✓ Aprobar
          </button>
          <button
            type="button"
            onClick={() => setMode("request")}
            className="rounded-full border px-4 py-2 text-xs font-semibold"
            style={{ borderColor: "#f59e0b", color: "#b45309" }}
          >
            🔄 Pedir cambios
          </button>
          <button
            type="button"
            onClick={() => setMode("comment")}
            className="rounded-full border px-4 py-2 text-xs font-medium"
            style={{ borderColor: "#d1d5db", color: "#555" }}
          >
            💬 Comentar
          </button>
        </div>
      )}

      {(mode === "approve" || mode === "request" || mode === "comment") && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium" style={{ color: "#555" }}>
            {mode === "approve" && "Agregá un comentario si querés (opcional)"}
            {mode === "request" && "Contanos qué hay que cambiar"}
            {mode === "comment" && "Tu comentario para el equipo"}
          </div>
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={3}
            placeholder={
              mode === "request"
                ? "Ej: cambiar la foto de portada, o usar otro tono..."
                : "Escribí acá..."
            }
            className="w-full rounded-md border p-2 text-xs"
            style={{ borderColor: "#d1d5db" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (mode === "approve") send("aprobar");
                else if (mode === "request") send("rechazar");
                else send("comentar");
              }}
              disabled={mode !== "approve" && mensaje.trim().length === 0}
              className="rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50"
              style={{ background: "#1a1a1a", color: "#FFD400" }}
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setMensaje("");
                setError(null);
              }}
              className="rounded-full px-4 py-2 text-xs font-medium"
              style={{ color: "#777" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mode === "sending" && (
        <div className="mt-4 text-xs" style={{ color: "#777" }}>
          Enviando…
        </div>
      )}
    </div>
  );
}
