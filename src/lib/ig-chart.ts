/**
 * Geometría del gráfico de evolución de seguidores del portal del cliente.
 * Lógica pura (testeable) separada del componente SVG (portal-ig-chart.tsx).
 */

export interface IgChartPoint {
  fecha: string; // YYYY-MM-DD
  followers: number;
}

export interface IgChartGeometry {
  /** Puntos muestreados con sus coordenadas ya proyectadas. */
  dots: { fecha: string; followers: number; x: number; y: number }[];
  linePath: string;
  areaPath: string;
  /** Gridlines horizontales: valor + coordenada y. */
  grid: { value: number; y: number }[];
  first: IgChartPoint;
  last: IgChartPoint;
  delta: number;
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

// ViewBox pensado para mobile-first: el portal se abre sobre todo desde el
// teléfono (~335px de card). 460 de ancho → escala ~0.73 y las fuentes de 11-14
// quedan legibles; en desktop el SVG se capa a ~620px (ver el componente).
export const IG_CHART_W = 460;
export const IG_CHART_H = 190;
const PAD = { top: 24, right: 52, bottom: 24, left: 48 };

export const fmtSeguidores = (n: number) => Math.round(n).toLocaleString("es-AR");

export function fmtFechaCorta(iso: string, hoy = new Date()): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[(m ?? 1) - 1]}${y !== hoy.getFullYear() ? ` ${String(y).slice(2)}` : ""}`;
}

/** Muestrea a lo sumo `max` puntos, preservando siempre el primero y el último. */
export function samplePoints(points: IgChartPoint[], max: number): IgChartPoint[] {
  if (points.length <= max) return points;
  const out: IgChartPoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Devuelve null si no hay serie suficiente para dibujar (menos de 2 puntos). */
export function computeIgChart(points: IgChartPoint[], maxPoints = 90): IgChartGeometry | null {
  if (points.length < 2) return null;

  const pts = samplePoints(points, maxPoints);
  const first = pts[0];
  const last = pts[pts.length - 1];

  // Escala Y con aire: es una línea (importa el CAMBIO), no arranca de 0.
  // Con serie plana igual dejamos un span mínimo para no dividir por cero.
  const values = pts.map((p) => p.followers);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = Math.max(dataMax - dataMin, Math.max(4, Math.round(dataMax * 0.02)));
  const yMin = Math.max(0, dataMin - span * 0.25);
  const yMax = dataMax + span * 0.25;

  const t0 = new Date(first.fecha).getTime();
  const t1 = new Date(last.fecha).getTime();
  const xOf = (p: IgChartPoint) => {
    const t = new Date(p.fecha).getTime();
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    return PAD.left + f * (IG_CHART_W - PAD.left - PAD.right);
  };
  const yOf = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (IG_CHART_H - PAD.top - PAD.bottom);

  const dots = pts.map((p) => ({
    fecha: p.fecha,
    followers: p.followers,
    x: Number(xOf(p).toFixed(1)),
    y: Number(yOf(p.followers).toFixed(1)),
  }));

  const linePath = dots.map((d, i) => `${i === 0 ? "M" : "L"}${d.x},${d.y}`).join(" ");
  const baseline = IG_CHART_H - PAD.bottom;
  const areaPath = `${linePath} L${dots[dots.length - 1].x},${baseline} L${dots[0].x},${baseline} Z`;

  const grid = [0.25, 0.5, 0.75].map((f) => {
    const value = yMin + f * (yMax - yMin);
    return { value, y: Number(yOf(value).toFixed(1)) };
  });

  return {
    dots,
    linePath,
    areaPath,
    grid,
    first,
    last,
    delta: last.followers - first.followers,
    width: IG_CHART_W,
    height: IG_CHART_H,
    pad: PAD,
  };
}
