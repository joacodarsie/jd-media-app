"use client";

/**
 * «Tu material» en el portal (18/10/2026): mientras el arranque espera las
 * fotos y videos del cliente, se lo pide acá con un botón a su carpeta y otro
 * para avisar que ya los subió (le llega una tarea a su community manager).
 */
import { useState } from "react";
import { Check, FolderOpen, Loader2 } from "lucide-react";

export function PortalMaterial({
  token,
  driveUrl,
  avisado,
}: {
  token: string;
  driveUrl: string | null;
  avisado: boolean;
}) {
  const [listo, setListo] = useState(avisado);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function avisar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/c/${token}/material`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo avisar.");
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo avisar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#111", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            <FolderOpen size={16} /> Abrir mi carpeta
          </a>
        )}
        {listo ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#e9f9ef", color: "#137a3d", fontSize: 14, fontWeight: 600 }}>
            <Check size={16} /> Listo, tu equipo ya lo está revisando
          </span>
        ) : (
          <button
            type="button"
            onClick={avisar}
            disabled={enviando}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "#ffd400", color: "#111", fontSize: 14, fontWeight: 700, border: 0, cursor: "pointer" }}
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Ya subí el material
          </button>
        )}
      </div>
      {error && <p style={{ color: "#b42318", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
