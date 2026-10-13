"use client";

import { useState } from "react";
import { PCT_RECOMENDADO, PCT_REFERIDO, linkReferido, linkWhatsappReferido, mensajeReferido } from "@/lib/referidos/referidos";

/**
 * «Recomendanos» en el portal del cliente (programa de referidos, 13/10/2026):
 * su link personal, el mensaje listo para WhatsApp y cómo van sus
 * recomendaciones. Los estilos son los del portal (inline, sin Tailwind).
 */
export function PortalRecomendar({
  code,
  recomendados,
}: {
  code: string;
  recomendados: { nombre: string; estado: string }[];
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(mensajeReferido(code)).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      },
      () => null
    );
  };
  const boton: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "11px 18px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    border: "1px solid #1a1a1a",
  };
  return (
    <div className="card" style={{ borderColor: "#FFD400", background: "linear-gradient(180deg, #fffbe6 0%, #fff 100%)" }}>
      <div className="card-label" style={{ color: "#8a6d00" }}>
        Recomendanos
      </div>
      <h2 className="card-title">¿Conocés a alguien que necesite lo mismo?</h2>
      <p style={{ fontSize: 14, color: "#444", margin: "0 0 14px", lineHeight: 1.55 }}>
        Mandale tu link: quien lo reciba tiene <b>{PCT_RECOMENDADO}% de descuento en su primer mes</b> y vos{" "}
        <b>{PCT_REFERIDO}% en tu próxima factura</b> por cada marca que se sume, sin tope. El tuyo se aplica
        cuando la marca que recomendaste paga su segundo mes.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <a
          href={linkWhatsappReferido(code)}
          target="_blank"
          rel="noreferrer"
          style={{ ...boton, background: "#1a1a1a", color: "#fff" }}
        >
          Mandar por WhatsApp
        </a>
        <button type="button" onClick={copiar} style={{ ...boton, background: "#fff", color: "#1a1a1a" }}>
          {copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#777", margin: 0, wordBreak: "break-all" }}>Tu link: {linkReferido(code)}</p>
      {recomendados.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 }}>Tus recomendaciones</div>
          {recomendados.map((r) => (
            <div key={r.nombre} style={{ fontSize: 13, color: "#333", padding: "3px 0" }}>
              <b>{r.nombre}</b> · <span style={{ color: "#777" }}>{r.estado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
