/**
 * «Tu contenido, en vivo» en el portal (19/10/2026): cada pieza que viene con
 * su línea Idea → Producción → Revisión → Lista, que se llena al entrar.
 */
import { ETAPAS, type PiezaProduccion } from "@/lib/portal/produccion";

const TIPO: Record<string, string> = { reel: "🎬", video: "🎬", post: "🖼️", carrusel: "🗂️", historia: "📱" };

function fecha(iso: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
}

export function PortalProduccion({
  piezas,
  enProduccion,
  listas,
}: {
  piezas: (PiezaProduccion & { etapa: number })[];
  enProduccion: number;
  listas: number;
}) {
  return (
    <div>
      <div className="pp-resumen">
        <span><b>{enProduccion}</b> en producción</span>
        <span className="pp-sep">·</span>
        <span><b>{listas}</b> listas para salir</span>
        <span className="pp-vivo"><i /> en vivo</span>
      </div>
      <ul className="pp-lista">
        {piezas.map((p, i) => (
          <li key={p.id} className="pp-pieza" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="pp-arriba">
              <span className="pp-titulo">
                {TIPO[p.tipo] ?? "✨"} {p.titulo || "Pieza"}
              </span>
              <span className="pp-fecha">{fecha(p.fecha_publicacion)}</span>
            </div>
            <div className="pp-linea" aria-label={`Etapa: ${ETAPAS[p.etapa]}`}>
              <span className="pp-relleno" style={{ width: `${(p.etapa / (ETAPAS.length - 1)) * 100}%`, animationDelay: `${300 + i * 70}ms` }} />
              {ETAPAS.map((e, j) => (
                <span key={e} className={`pp-paso${j < p.etapa ? " pp-hecho" : j === p.etapa ? " pp-ahora" : ""}`} style={{ left: `${(j / (ETAPAS.length - 1)) * 100}%` }}>
                  <i />
                  <small>{e}</small>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
