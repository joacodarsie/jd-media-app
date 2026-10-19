"use client";

/**
 * Aprobar deslizando (18/10/2026): las piezas para revisar como tarjetas
 * apiladas. A la derecha se aprueba, a la izquierda se piden cambios (con qué
 * cambiar). Pensado para el celular: el cliente revisa el mes en un minuto.
 * Usa el mismo /api/c/[token]/feedback que las tarjetas de siempre.
 */
import { useRef, useState } from "react";

interface Pieza {
  id: string;
  titulo: string;
  copy: string | null;
  guion: string | null;
  descripcion: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  asset_url: string | null;
}

const esImagen = (u: string | null) => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Cordoba" }) : "Sin fecha";

export function PortalDeslizar({ piezas, token }: { piezas: Pieza[]; token: string }) {
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [saliendo, setSaliendo] = useState<null | "der" | "izq">(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState({ aprobadas: 0, cambios: 0 });
  const inicio = useRef<number | null>(null);

  const actual = piezas[i];
  const terminado = i >= piezas.length;

  async function enviar(tipo: "aprobar" | "rechazar", mensaje?: string) {
    setError(null);
    const res = await fetch(`/api/c/${token}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publication_id: actual.id, tipo, mensaje }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const j = res ? await res.json().catch(() => null) : null;
      setError(j?.error ?? "No se pudo enviar. Probá de nuevo.");
      setDx(0);
      setSaliendo(null);
      return false;
    }
    return true;
  }

  async function decidir(lado: "der" | "izq") {
    if (!actual || saliendo) return;
    if (lado === "izq") {
      setPidiendo(true);
      setDx(0);
      return;
    }
    setSaliendo("der");
    const ok = await enviar("aprobar");
    if (!ok) return;
    setCuenta((c) => ({ ...c, aprobadas: c.aprobadas + 1 }));
    setTimeout(siguiente, 280);
  }

  async function mandarCambios() {
    if (!texto.trim()) return setError("Contanos qué cambiar.");
    setSaliendo("izq");
    const ok = await enviar("rechazar", texto.trim());
    if (!ok) return;
    setCuenta((c) => ({ ...c, cambios: c.cambios + 1 }));
    setPidiendo(false);
    setTexto("");
    setTimeout(siguiente, 280);
  }

  function siguiente() {
    setSaliendo(null);
    setDx(0);
    setI((x) => x + 1);
  }

  const onDown = (e: React.PointerEvent) => {
    if (pidiendo || saliendo) return;
    inicio.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (inicio.current === null) return;
    setDx(e.clientX - inicio.current);
  };
  const onUp = () => {
    if (inicio.current === null) return;
    inicio.current = null;
    if (dx > 90) decidir("der");
    else if (dx < -90) decidir("izq");
    else setDx(0);
  };

  if (!piezas.length) return null;

  const transform = saliendo === "der" ? "translateX(130%) rotate(18deg)" : saliendo === "izq" ? "translateX(-130%) rotate(-18deg)" : `translateX(${dx}px) rotate(${dx / 18}deg)`;

  return (
    <>
      <button type="button" className="pd-abrir" onClick={() => { setAbierto(true); setI(0); setCuenta({ aprobadas: 0, cambios: 0 }); }}>
        <span aria-hidden="true">👆</span> Revisar de a una, deslizando
      </button>

      {abierto && (
        <div className="pd-fondo" role="dialog" aria-label="Revisar piezas">
          <div className="pd-arriba">
            <span>{terminado ? "Listo" : `${i + 1} de ${piezas.length}`}</span>
            <button type="button" onClick={() => { setAbierto(false); if (terminado) location.reload(); }} aria-label="Cerrar">✕</button>
          </div>

          {terminado ? (
            <div className="pd-fin">
              <div className="pd-fin-emoji">🎉</div>
              <h2>¡Revisaste todo!</h2>
              <p>
                {cuenta.aprobadas > 0 && `${cuenta.aprobadas} aprobada${cuenta.aprobadas === 1 ? "" : "s"}`}
                {cuenta.aprobadas > 0 && cuenta.cambios > 0 && " · "}
                {cuenta.cambios > 0 && `${cuenta.cambios} con cambios`}
              </p>
              <p className="pd-sub">Tu equipo ya lo está viendo.</p>
              <button type="button" className="pd-cerrar" onClick={() => location.reload()}>Volver a mi plataforma</button>
            </div>
          ) : (
            <>
              <div className="pd-mazo">
                {piezas[i + 1] && <div className="pd-carta pd-atras" aria-hidden="true" />}
                <div
                  className={`pd-carta ${saliendo ? "pd-sale" : dx === 0 ? "pd-quieta" : ""}`}
                  style={{ transform }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  <span className="pd-sello pd-sello-si" style={{ opacity: Math.max(0, Math.min(1, dx / 90)) }}>APROBADA</span>
                  <span className="pd-sello pd-sello-no" style={{ opacity: Math.max(0, Math.min(1, -dx / 90)) }}>CAMBIOS</span>
                  {esImagen(actual.asset_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actual.asset_url!} alt="" draggable={false} className="pd-img" />
                  ) : (
                    <div className="pd-sin-img">
                      <span>{actual.tipo === "reel" ? "🎬" : actual.tipo === "historia" ? "📱" : "🖼️"}</span>
                      {actual.asset_url && (
                        <a href={actual.asset_url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
                          Ver la pieza →
                        </a>
                      )}
                    </div>
                  )}
                  <div className="pd-info">
                    <div className="pd-meta">{actual.tipo} · {actual.red} · {fecha(actual.fecha_publicacion)}</div>
                    <div className="pd-titulo">{actual.titulo}</div>
                    {(actual.copy || actual.guion || actual.descripcion) && (
                      <div className="pd-copy">{actual.copy || actual.guion || actual.descripcion}</div>
                    )}
                  </div>
                </div>
              </div>

              {error && <p className="pd-error">{error}</p>}

              {pidiendo ? (
                <div className="pd-cambios">
                  <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué te gustaría cambiar?" rows={3} />
                  <div className="pd-cambios-botones">
                    <button type="button" onClick={() => { setPidiendo(false); setTexto(""); setError(null); }}>Volver</button>
                    <button type="button" className="pd-mandar" onClick={mandarCambios}>Mandar cambios</button>
                  </div>
                </div>
              ) : (
                <div className="pd-botones">
                  <button type="button" className="pd-no" onClick={() => decidir("izq")} aria-label="Pedir cambios">✎<span>Cambios</span></button>
                  <button type="button" className="pd-si" onClick={() => decidir("der")} aria-label="Aprobar">✓<span>Aprobar</span></button>
                </div>
              )}
              <p className="pd-ayuda">Deslizá a la derecha para aprobar, a la izquierda para pedir cambios.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
