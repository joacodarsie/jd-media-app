"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PUBLICATION_TYPE_HEX } from "@/lib/constants";

/**
 * Calendario de contenidos del Cliente Portal.
 * - Vista calendario (mes) + vista lista (agenda).
 * - Tocar una pieza abre el detalle (copy, imagen, hashtags).
 * - Desde el detalle el cliente deja un comentario que llega a la CM
 *   (notificación + se ve en la pieza del lado del equipo).
 */

export interface PortalPub {
  id: string;
  titulo: string;
  fecha_publicacion: string | null;
  red: string;
  tipo: string;
  estado: string;
  copy: string | null;
  descripcion: string | null;
  hashtags: string | null;
  asset_url: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  post: "Posteo",
  reel: "Reel",
  carrusel: "Carrusel",
  historia: "Historia",
  video: "Video",
  otro: "Pieza",
};

// Orden de preferencia para la leyenda.
const TIPO_ORDER = ["post", "reel", "historia", "carrusel", "video", "otro"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function tipoColor(tipo: string) {
  return (PUBLICATION_TYPE_HEX as Record<string, string>)[tipo] ?? "#94a3b8";
}
function tipoLabel(tipo: string) {
  return TIPO_LABEL[tipo] ?? "Pieza";
}
function isImage(url: string | null): boolean {
  if (!url) return false;
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url) || url.startsWith("data:image");
}

export function PortalContent({ pubs, token }: { pubs: PortalPub[]; token: string }) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [openId, setOpenId] = useState<string | null>(null);

  // Agrupar por día (clave local). Las piezas sin fecha van a un bucket aparte.
  const { byDay, dated, undated, months } = useMemo(() => {
    const byDay = new Map<string, PortalPub[]>();
    const dated: PortalPub[] = [];
    const undated: PortalPub[] = [];
    const monthSet = new Set<string>();
    for (const p of pubs) {
      if (!p.fecha_publicacion) {
        undated.push(p);
        continue;
      }
      const d = new Date(p.fecha_publicacion);
      dated.push(p);
      const k = dayKey(d);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(p);
      monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const months = Array.from(monthSet)
      .map((s) => {
        const [y, m] = s.split("-").map(Number);
        return { y, m };
      })
      .sort((a, b) => (a.y - b.y) || (a.m - b.m));
    return { byDay, dated, undated, months };
  }, [pubs]);

  // Mes mostrado en el calendario (arranca en el primer mes con piezas o el actual).
  const firstMonth = months[0] ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
  const [cursor, setCursor] = useState(firstMonth);
  const cursorIdx = months.findIndex((x) => x.y === cursor.y && x.m === cursor.m);
  const canPrev = cursorIdx > 0;
  const canNext = cursorIdx >= 0 && cursorIdx < months.length - 1;

  // Día seleccionado dentro del mes (primer día con piezas del mes en curso).
  const [selKey, setSelKey] = useState<string | null>(null);

  const openPub = pubs.find((p) => p.id === openId) ?? null;

  // Construir la grilla del mes (semana arranca lunes).
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startOffset = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  // Piezas del día seleccionado (o, si no hay selección, del primer día con piezas del mes).
  const monthDays = grid.filter((d): d is Date => !!d && byDay.has(dayKey(d)));
  const effectiveSelKey = selKey && byDay.has(selKey) ? selKey : (monthDays[0] ? dayKey(monthDays[0]) : null);
  const selPubs = effectiveSelKey ? (byDay.get(effectiveSelKey) ?? []) : [];

  // Tipos presentes (para la leyenda), en orden de preferencia.
  const legendTipos = useMemo(() => {
    const present = new Set(pubs.map((p) => p.tipo));
    const ordered = TIPO_ORDER.filter((t) => present.has(t));
    const rest = [...present].filter((t) => !TIPO_ORDER.includes(t));
    return [...ordered, ...rest];
  }, [pubs]);

  if (pubs.length === 0) {
    return (
      <p style={{ color: "#999", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
        Todavía no hay piezas planificadas. En cuanto carguemos el calendario, va a aparecer acá.
      </p>
    );
  }

  return (
    <div>
      {/* Toggle de vista */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <ToggleBtn active={view === "calendar"} onClick={() => setView("calendar")}>
          📅 Calendario
        </ToggleBtn>
        <ToggleBtn active={view === "list"} onClick={() => setView("list")}>
          📋 Lista
        </ToggleBtn>
      </div>

      {/* Leyenda: qué representa cada color */}
      <Legend tipos={legendTipos} />

      {view === "calendar" ? (
        <>
          {/* Navegación de mes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <NavBtn disabled={!canPrev} onClick={() => canPrev && setCursor(months[cursorIdx - 1])}>‹</NavBtn>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {MESES[cursor.m]} {cursor.y}
            </div>
            <NavBtn disabled={!canNext} onClick={() => canNext && setCursor(months[cursorIdx + 1])}>›</NavBtn>
          </div>

          {/* Encabezado días */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {DIAS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#aaa", fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          {/* Grilla */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const k = dayKey(d);
              const dayPubs = byDay.get(k) ?? [];
              const isSel = k === effectiveSelKey;
              const hasPubs = dayPubs.length > 0;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => hasPubs && setSelKey(k)}
                  style={{
                    aspectRatio: "1 / 1",
                    border: isSel ? "2px solid #1a1a1a" : "1px solid #eee",
                    borderRadius: 10,
                    background: hasPubs ? "#fffdf0" : "#fff",
                    cursor: hasPubs ? "pointer" : "default",
                    padding: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: hasPubs ? 700 : 400, color: hasPubs ? "#1a1a1a" : "#bbb" }}>
                    {d.getDate()}
                  </span>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {dayPubs.slice(0, 3).map((p) => (
                      <span key={p.id} style={{ width: 6, height: 6, borderRadius: 999, background: tipoColor(p.tipo) }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Piezas del día seleccionado */}
          {selPubs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 8 }}>
                {new Date(selPubs[0].fecha_publicacion!).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selPubs.map((p) => <PubRow key={p.id} pub={p} onClick={() => setOpenId(p.id)} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        // Vista lista (agenda)
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dated.map((p) => (
            <PubRow key={p.id} pub={p} showDate onClick={() => setOpenId(p.id)} />
          ))}
          {undated.length > 0 && (
            <>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginTop: 8 }}>
                Sin fecha definida
              </div>
              {undated.map((p) => <PubRow key={p.id} pub={p} onClick={() => setOpenId(p.id)} />)}
            </>
          )}
        </div>
      )}

      {openPub && <PubDetail pub={openPub} token={token} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Legend({ tipos }: { tipos: string[] }) {
  if (tipos.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px 16px",
        marginBottom: 14,
        padding: "10px 12px",
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", fontWeight: 700 }}>
        Referencias
      </span>
      {tipos.map((t) => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#444" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: tipoColor(t) }} />
          {tipoLabel(t)}
        </span>
      ))}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: active ? "none" : "1px solid #e5e5e5",
        background: active ? "#1a1a1a" : "#fff",
        color: active ? "#FFD400" : "#666",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function NavBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid #e5e5e5",
        background: "#fff",
        fontSize: 18,
        lineHeight: 1,
        color: disabled ? "#ccc" : "#1a1a1a",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PubRow({ pub, onClick, showDate }: { pub: PortalPub; onClick: () => void; showDate?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: 10,
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fff",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: tipoColor(pub.tipo), minHeight: 36 }} />
      {isImage(pub.asset_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pub.asset_url!} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <span style={{ width: 40, height: 40, borderRadius: 8, background: "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {pub.tipo === "reel" || pub.tipo === "video" ? "🎬" : pub.tipo === "historia" ? "⚡" : "🖼️"}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pub.titulo}
        </span>
        <span style={{ display: "block", fontSize: 11, color: "#888", marginTop: 2, textTransform: "capitalize" }}>
          {showDate && pub.fecha_publicacion
            ? `${new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} · `
            : ""}
          {TIPO_LABEL[pub.tipo] ?? pub.tipo} · {pub.red}
        </span>
      </span>
      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
    </button>
  );
}

function PubDetail({ pub, token, onClose }: { pub: PortalPub; token: string; onClose: () => void }) {
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
        body: JSON.stringify({ publication_id: pub.id, tipo: "comentar", mensaje: mensaje.trim() }),
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

  return (
    <div
      onClick={onClose}
      className="portal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
        padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="portal-sheet"
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: 600,
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "20px 20px 0 0",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{pub.titulo}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2, textTransform: "capitalize" }}>
              {pub.fecha_publicacion && `${new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · `}
              {TIPO_LABEL[pub.tipo] ?? pub.tipo} · {pub.red}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "#f4f4f4", borderRadius: 999, width: 32, height: 32, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        {isImage(pub.asset_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pub.asset_url!} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 14, maxHeight: 360, objectFit: "cover" }} />
        )}
        {!isImage(pub.asset_url) && pub.asset_url && (
          <a href={pub.asset_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "#1a1a1a", textDecoration: "underline" }}>
            Ver pieza adjunta →
          </a>
        )}

        {pub.descripcion && (
          <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, marginTop: 14 }}>{pub.descripcion}</p>
        )}

        {pub.copy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: 6 }}>Texto de la publicación</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#333", lineHeight: 1.6, background: "#fafafa", borderRadius: 10, padding: 14 }}>{pub.copy}</div>
          </div>
        )}

        {pub.hashtags && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#2563eb", lineHeight: 1.5 }}>{pub.hashtags}</div>
        )}

        {/* Comentario → llega a la CM */}
        <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
          {state === "done" ? (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: 14, color: "#065f46", fontSize: 14, fontWeight: 600 }}>
              ✓ Tu comentario le llegó al equipo. ¡Gracias!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💬 Dejá tu comentario</div>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={3}
                placeholder="¿Querés cambiar algo, sumar una idea o aprobar esta pieza? Escribilo acá y le llega al equipo al instante."
                style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
              />
              {error && <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{error}</div>}
              <button
                type="button"
                onClick={send}
                disabled={state === "sending" || !mensaje.trim()}
                style={{ marginTop: 10, padding: "10px 18px", borderRadius: 999, border: "none", background: "#1a1a1a", color: "#FFD400", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: state === "sending" || !mensaje.trim() ? 0.5 : 1 }}
              >
                {state === "sending" ? "Enviando…" : "Enviar comentario"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
