"use client";

/**
 * «Tu abono del mes» en el portal (19/10/2026): datos para transferir con
 * copiar de un toque y «Ya pagué», que le avisa a la PM.
 */
import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

export function PortalAbono({
  token,
  mes,
  hastaDia,
  alias,
  cvu,
  titular,
  avisado,
}: {
  token: string;
  mes: string;
  hastaDia: number;
  alias: string;
  cvu: string;
  titular: string;
  avisado: boolean;
}) {
  const [listo, setListo] = useState(avisado);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copiar = (k: string, v: string) =>
    navigator.clipboard.writeText(v).then(
      () => {
        setCopiado(k);
        setTimeout(() => setCopiado(null), 1800);
      },
      () => null
    );

  async function yaPague() {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/c/${token}/pago`, { method: "POST" });
      if (!r.ok) throw new Error();
      setListo(true);
    } catch {
      setError("No pudimos avisar. Probá de nuevo o mandanos el comprobante por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  const Fila = ({ k, label, valor }: { k: string; label: string; valor: string }) => (
    <button type="button" className="ab-fila" onClick={() => copiar(k, valor)}>
      <span className="ab-label">{label}</span>
      <span className="ab-valor">{valor}</span>
      <span className="ab-copiar">{copiado === k ? <Check size={14} /> : <Copy size={14} />}</span>
    </button>
  );

  return (
    <div className="card ab-card">
      <div className="card-label">Tu abono de {mes}</div>
      <h2 className="card-title" style={{ marginBottom: 4 }}>
        {listo ? "¡Gracias! Ya lo estamos confirmando" : `Se abona hasta el ${hastaDia}`}
      </h2>
      {listo ? (
        <p style={{ fontSize: 13, color: "#555", margin: 0 }}>Te avisamos si hace falta algo más.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>Transferí por Mercado Pago. Tocá un dato para copiarlo.</p>
          <div className="ab-datos">
            <Fila k="alias" label="Alias" valor={alias} />
            <Fila k="cvu" label="CVU" valor={cvu} />
            <div className="ab-fila ab-fija">
              <span className="ab-label">Titular</span>
              <span className="ab-valor">{titular}</span>
            </div>
          </div>
          <button type="button" className="ab-pague" onClick={yaPague} disabled={enviando}>
            {enviando ? <Loader2 size={16} className="pr-gira" /> : "✓"} Ya pagué
          </button>
          {error && <p style={{ color: "#b91c1c", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
