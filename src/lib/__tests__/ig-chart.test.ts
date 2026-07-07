import { describe, expect, it } from "vitest";
import {
  computeIgChart,
  samplePoints,
  fmtFechaCorta,
  IG_CHART_H,
  IG_CHART_W,
  type IgChartPoint,
} from "../ig-chart";

const pt = (fecha: string, followers: number): IgChartPoint => ({ fecha, followers });

describe("computeIgChart", () => {
  it("devuelve null con menos de 2 puntos", () => {
    expect(computeIgChart([])).toBeNull();
    expect(computeIgChart([pt("2026-07-01", 100)])).toBeNull();
  });

  it("proyecta extremos dentro del área de dibujo y calcula el delta", () => {
    const g = computeIgChart([
      pt("2026-06-01", 4800),
      pt("2026-06-15", 4950),
      pt("2026-07-01", 5120),
    ])!;
    expect(g.delta).toBe(320);
    expect(g.first.followers).toBe(4800);
    expect(g.last.followers).toBe(5120);
    for (const d of g.dots) {
      expect(d.x).toBeGreaterThanOrEqual(g.pad.left);
      expect(d.x).toBeLessThanOrEqual(IG_CHART_W - g.pad.right);
      expect(d.y).toBeGreaterThanOrEqual(g.pad.top);
      expect(d.y).toBeLessThanOrEqual(IG_CHART_H - g.pad.bottom);
    }
    // Serie creciente → el último punto queda MÁS ARRIBA (y menor) que el primero.
    expect(g.dots[g.dots.length - 1].y).toBeLessThan(g.dots[0].y);
    expect(g.linePath.startsWith("M")).toBe(true);
    expect(g.areaPath.endsWith("Z")).toBe(true);
    expect(g.grid).toHaveLength(3);
  });

  it("muestrea series largas preservando extremos", () => {
    const points: IgChartPoint[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.UTC(2025, 6, 1 + i)).toISOString().slice(0, 10);
      points.push(pt(d, 1000 + i * 3));
    }
    const g = computeIgChart(points)!;
    expect(g.dots.length).toBeLessThanOrEqual(90);
    expect(g.first.followers).toBe(1000);
    expect(g.last.followers).toBe(1000 + 364 * 3);

    const sampled = samplePoints(points, 90);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1]);
  });

  it("aguanta una serie plana (sin dividir por cero ni NaN)", () => {
    const g = computeIgChart([pt("2026-06-01", 500), pt("2026-07-01", 500)])!;
    expect(g.delta).toBe(0);
    for (const d of g.dots) {
      expect(Number.isFinite(d.x)).toBe(true);
      expect(Number.isFinite(d.y)).toBe(true);
    }
    for (const gl of g.grid) expect(Number.isFinite(gl.y)).toBe(true);
  });

  it("aguanta dos snapshots del mismo día (t0 == t1)", () => {
    const g = computeIgChart([pt("2026-07-01", 100), pt("2026-07-01", 120)])!;
    for (const d of g.dots) expect(Number.isFinite(d.x)).toBe(true);
  });
});

describe("fmtFechaCorta", () => {
  const hoy = new Date("2026-07-07");
  it("omite el año si es el actual", () => {
    expect(fmtFechaCorta("2026-07-01", hoy)).toBe("1 jul");
  });
  it("agrega el año corto si es otro", () => {
    expect(fmtFechaCorta("2025-12-15", hoy)).toBe("15 dic 25");
  });
});
