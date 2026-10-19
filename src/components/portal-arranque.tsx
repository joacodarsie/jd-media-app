/**
 * «Tu arranque» en el portal (19/10/2026): los 6 pasos del primer mes, con
 * una barra que se llena y los que le tocan al cliente marcados.
 */
import type { PasoArranque } from "@/lib/portal/tu-arranque";

export function PortalArranque({ pasos }: { pasos: PasoArranque[] }) {
  const hechos = pasos.filter((p) => p.hecho).length;
  const completo = hechos === pasos.length;
  const pct = Math.round((hechos / pasos.length) * 100);
  return (
    <div className={`card ta-card${completo ? " ta-completo" : ""}`}>
      <div className="card-label">Tu arranque</div>
      <h2 className="card-title" style={{ marginBottom: 6 }}>
        {completo ? "¡Arranque completo! 🎉" : `${hechos} de ${pasos.length} pasos listos`}
      </h2>
      <div className="ta-barra">
        <span style={{ width: `${pct}%` }} />
      </div>
      <ul className="ta-pasos">
        {pasos.map((p, i) => (
          <li key={p.clave} className={p.hecho ? "ta-hecho" : p.teToca ? "ta-tuyo" : ""} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="ta-check" aria-hidden="true">
              {p.hecho ? "✓" : i + 1}
            </span>
            <span className="ta-texto">{p.titulo}</span>
            {!p.hecho && p.teToca && <span className="ta-chip">Te toca</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
