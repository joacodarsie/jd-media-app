"use client";

/**
 * «Tu mes en JD Media» (19/10/2026): el resumen del mes cerrado en historias,
 * tipo Spotify Wrapped. Avanza solo cada 5 segundos; tocando a la derecha
 * avanza, a la izquierda vuelve. Las placas las arma lib/portal/tu-mes.ts.
 */
import { useCallback, useEffect, useState } from "react";
import type { Placa } from "@/lib/portal/tu-mes";

const DURACION = 5000;
const FONDOS = [
  "linear-gradient(160deg, #1a1a1a 0%, #3a2f05 100%)",
  "linear-gradient(160deg, #FFD400 0%, #ffb800 100%)",
  "linear-gradient(160deg, #14233a 0%, #1d2140 100%)",
  "linear-gradient(160deg, #3a1f2a 0%, #241a2e 100%)",
  "linear-gradient(160deg, #0f3d2e 0%, #13261f 100%)",
  "linear-gradient(160deg, #2a1240 0%, #15172b 100%)",
];

function Cuenta({ valor, prefijo = "" }: { valor: number; prefijo?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(valor);
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      setN(Math.round(valor * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return (
    <>
      {prefijo}
      {n.toLocaleString("es-AR")}
    </>
  );
}

export function PortalTuMes({ placas, mesLabel }: { placas: Placa[]; mesLabel: string }) {
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setI(0);
  }, []);
  const siguiente = useCallback(() => setI((x) => (x + 1 < placas.length ? x + 1 : x)), [placas.length]);
  const anterior = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    if (!abierto || pausa || i >= placas.length - 1) return;
    const t = setTimeout(siguiente, DURACION);
    return () => clearTimeout(t);
  }, [abierto, pausa, i, placas.length, siguiente]);

  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") siguiente();
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [abierto, cerrar, siguiente]);

  const p = placas[i];
  const claro = i % FONDOS.length === 1;

  return (
    <>
      <button type="button" className="tm-abrir" onClick={() => setAbierto(true)}>
        <span className="tm-play">▶</span>
        <span>
          <b>Tu {mesLabel} en JD Media</b>
          <small>Tu resumen del mes, en 30 segundos</small>
        </span>
      </button>

      {abierto && p && (
        <div className="tm-fondo" role="dialog" aria-label={`Tu ${mesLabel} en JD Media`}>
          <div className="tm-placa" style={{ background: FONDOS[i % FONDOS.length], color: claro ? "#111" : "#fff" }}>
            <div className="tm-barras">
              {placas.map((_, j) => (
                <span key={j}>
                  <i
                    className={j < i ? "tm-llena" : j === i ? "tm-corre" : ""}
                    style={j === i ? { animationDuration: `${DURACION}ms`, animationPlayState: pausa || i === placas.length - 1 ? "paused" : "running" } : undefined}
                  />
                </span>
              ))}
            </div>
            <button type="button" className="tm-cerrar" onClick={cerrar} aria-label="Cerrar">
              ✕
            </button>

            <div className="tm-contenido" key={i}>
              {p.tipo === "portada" && (
                <>
                  <div className="tm-chico">{p.sub}</div>
                  <h2 className="tm-titulo-gigante">{p.titulo}</h2>
                  <div className="tm-chico">Tocá para seguir →</div>
                </>
              )}
              {p.tipo === "numero" && (
                <>
                  <div className="tm-numero">
                    <Cuenta valor={p.valor} prefijo={p.prefijo} />
                  </div>
                  <h2 className="tm-titulo">{p.titulo}</h2>
                  <p className="tm-sub">{p.sub}</p>
                </>
              )}
              {p.tipo === "estrella" && (
                <>
                  <div className="tm-emoji">⭐</div>
                  <h2 className="tm-titulo">{p.titulo}</h2>
                  <p className="tm-cita">«{p.caption}»</p>
                  {p.datos && <p className="tm-sub">{p.datos}</p>}
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="tm-link" onClick={(e) => e.stopPropagation()}>
                      Verla en Instagram
                    </a>
                  )}
                </>
              )}
              {p.tipo === "cierre" && (
                <>
                  <div className="tm-emoji">🚀</div>
                  <h2 className="tm-titulo-gigante">{p.titulo}</h2>
                  <p className="tm-sub">{p.sub}</p>
                  <button type="button" className="tm-link" onClick={cerrar}>
                    Volver a mi plataforma
                  </button>
                </>
              )}
            </div>

            {p.tipo !== "cierre" && (
              <>
                <button
                  type="button"
                  className="tm-zona tm-izq"
                  aria-label="Anterior"
                  onClick={anterior}
                  onPointerDown={() => setPausa(true)}
                  onPointerUp={() => setPausa(false)}
                  onPointerLeave={() => setPausa(false)}
                />
                <button
                  type="button"
                  className="tm-zona tm-der"
                  aria-label="Siguiente"
                  onClick={siguiente}
                  onPointerDown={() => setPausa(true)}
                  onPointerUp={() => setPausa(false)}
                  onPointerLeave={() => setPausa(false)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
