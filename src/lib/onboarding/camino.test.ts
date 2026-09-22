import { describe, it, expect } from "vitest";
import {
  avanceDelCamino,
  caminoDePasos,
  pasoActual,
  puntosDelCamino,
} from "./camino";

describe("caminoDePasos", () => {
  it("la primera fila va de izquierda a derecha", () => {
    const { nodos } = caminoDePasos(5, 5);
    expect(nodos.map((n) => n.columna)).toEqual([0, 1, 2, 3, 4]);
    expect(nodos.every((n) => n.fila === 0)).toBe(true);
  });

  it("la segunda vuelve para el otro lado: por eso es un camino", () => {
    const { nodos } = caminoDePasos(10, 5);
    expect(nodos.slice(5).map((n) => n.columna)).toEqual([4, 3, 2, 1, 0]);
    expect(nodos.slice(5).every((n) => n.fila === 1)).toBe(true);
  });

  it("el paso que cierra una fila y el que abre la siguiente quedan pegados", () => {
    const { nodos } = caminoDePasos(6, 5);
    expect(nodos[4].columna).toBe(nodos[5].columna);
    expect(nodos[5].fila).toBe(nodos[4].fila + 1);
  });

  it("los 13 pasos de una cuenta entran en tres filas", () => {
    const c = caminoDePasos(13, 5);
    expect(c.filas).toBe(3);
    expect(c.nodos).toHaveLength(13);
  });

  it("las coordenadas son porcentajes adentro del contenedor", () => {
    const { nodos } = caminoDePasos(10, 5);
    expect(nodos[0].x).toBe(10);
    expect(nodos[0].y).toBe(25);
    expect(nodos[4].x).toBe(90);
    expect(nodos[9].y).toBe(75);
    for (const n of nodos) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(100);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(100);
    }
  });

  it("sin pasos no hay camino, y no revienta", () => {
    expect(caminoDePasos(0)).toEqual({ nodos: [], filas: 0, columnas: 5 });
  });

  it("una sola columna es una fila por paso", () => {
    const c = caminoDePasos(3, 1);
    expect(c.filas).toBe(3);
    expect(c.nodos.map((n) => n.fila)).toEqual([0, 1, 2]);
  });

  it("cero columnas no divide por cero", () => {
    expect(caminoDePasos(2, 0).columnas).toBe(1);
  });
});

describe("puntosDelCamino", () => {
  it("son los centros de los nodos, en orden", () => {
    const c = caminoDePasos(3, 5);
    expect(puntosDelCamino(c)).toEqual(c.nodos.map((n) => ({ x: n.x, y: n.y })));
  });
});

describe("avanceDelCamino", () => {
  it("cuenta los hechos seguidos desde el principio", () => {
    expect(avanceDelCamino([true, true, false, false])).toBe(2);
  });

  it("un paso tildado más adelante no adelanta la línea", () => {
    expect(avanceDelCamino([true, false, true, true])).toBe(1);
  });

  it("todo hecho, todo pintado; nada hecho, nada pintado", () => {
    expect(avanceDelCamino([true, true])).toBe(2);
    expect(avanceDelCamino([false, true])).toBe(0);
    expect(avanceDelCamino([])).toBe(0);
  });
});

describe("pasoActual", () => {
  it("es el primero sin hacer", () => {
    expect(pasoActual([true, true, false, false])).toBe(2);
    expect(pasoActual([false])).toBe(0);
  });

  it("con todo hecho no hay paso actual", () => {
    expect(pasoActual([true, true])).toBeNull();
    expect(pasoActual([])).toBeNull();
  });

  it("agarra el hueco del medio, no el final", () => {
    expect(pasoActual([true, false, true])).toBe(1);
  });
});
