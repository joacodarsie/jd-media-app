/**
 * Gráfico de evolución de seguidores para el portal PÚBLICO del cliente.
 * SVG puro renderizado en el server (sin JS en el cliente, igual que el resto
 * del portal). Serie única: línea fina en tinta + área suave en el amarillo de
 * marca; etiquetas solo en el primer y último punto; grilla recesiva.
 * La geometría vive en lib/ig-chart.ts (pura, testeada).
 */
import {
  computeIgChart,
  fmtFechaCorta,
  fmtSeguidores,
  type IgChartPoint,
} from "@/lib/ig-chart";

export type { IgChartPoint };

export function PortalIgChart({ points }: { points: IgChartPoint[] }) {
  const g = computeIgChart(points);
  if (!g) return null;

  const firstDot = g.dots[0];
  const lastDot = g.dots[g.dots.length - 1];

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      width="100%"
      role="img"
      aria-label={`Evolución de seguidores: de ${fmtSeguidores(g.first.followers)} el ${fmtFechaCorta(
        g.first.fecha
      )} a ${fmtSeguidores(g.last.followers)} el ${fmtFechaCorta(g.last.fecha)} (${
        g.delta >= 0 ? "+" : ""
      }${fmtSeguidores(g.delta)})`}
      style={{ display: "block", maxWidth: 620, margin: "0 auto" }}
    >
      <defs>
        <linearGradient id="igArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD400" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFD400" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Grilla recesiva */}
      {g.grid.map((gl) => (
        <g key={gl.y}>
          <line x1={g.pad.left} x2={g.width - g.pad.right} y1={gl.y} y2={gl.y} stroke="#eeeeee" strokeWidth="1" />
          <text x={g.pad.left - 8} y={gl.y + 3} textAnchor="end" fontSize="11" fill="#999">
            {fmtSeguidores(gl.value)}
          </text>
        </g>
      ))}

      {/* Área + línea */}
      <path d={g.areaPath} fill="url(#igArea)" />
      <path d={g.linePath} fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Tooltips nativos por punto (sin JS): círculos de hit invisibles */}
      {g.dots.map((d) => (
        <circle key={d.fecha} cx={d.x} cy={d.y} r="10" fill="transparent">
          <title>{`${fmtFechaCorta(d.fecha)}: ${fmtSeguidores(d.followers)} seguidores`}</title>
        </circle>
      ))}

      {/* Extremos: marcador con anillo de superficie + valor */}
      <circle cx={firstDot.x} cy={firstDot.y} r="4" fill="#1a1a1a" stroke="#fff" strokeWidth="2" />
      <circle cx={lastDot.x} cy={lastDot.y} r="4.5" fill="#1a1a1a" stroke="#fff" strokeWidth="2" />
      <text x={firstDot.x} y={firstDot.y - 10} textAnchor="start" fontSize="13" fontWeight="600" fill="#1a1a1a">
        {fmtSeguidores(g.first.followers)}
      </text>
      <text x={lastDot.x + 8} y={lastDot.y + 4} textAnchor="start" fontSize="14" fontWeight="700" fill="#1a1a1a">
        {fmtSeguidores(g.last.followers)}
      </text>

      {/* Fechas de los extremos */}
      <text x={g.pad.left} y={g.height - 6} textAnchor="start" fontSize="11" fill="#999">
        {fmtFechaCorta(g.first.fecha)}
      </text>
      <text x={g.width - g.pad.right} y={g.height - 6} textAnchor="end" fontSize="11" fill="#999">
        {fmtFechaCorta(g.last.fecha)}
      </text>
    </svg>
  );
}
