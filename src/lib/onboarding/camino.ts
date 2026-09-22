/**
 * La geometría del caminito del onboarding.
 *
 * El arranque de una cuenta era una lista de casillas para tildar y, mirándola,
 * no se contestaba de un vistazo la única pregunta que importa: **¿por dónde
 * vamos?**. Pedido del dueño (22/9/2026): que se vea como un mapa, con los
 * pasos encadenados y lo hecho a la vista.
 *
 * El recorrido va en serpentina —la fila de arriba hacia la derecha, la
 * siguiente hacia la izquierda— porque así entran 13 o 15 pasos en tres
 * renglones sin que nada quede minúsculo, y el orden se sigue con el dedo.
 *
 * Todo en porcentajes: el componente pone los nodos con `left`/`top` y dibuja
 * la línea con un SVG que usa el mismo sistema, así el mapa escala solo de un
 * celular a una pantalla grande.
 *
 * Módulo PURO: entra cuántos pasos hay, salen las coordenadas.
 */

export interface NodoDelCamino {
  /** Índice del paso en la lista original. */
  i: number;
  fila: number;
  columna: number;
  /** 0..100, el centro del nodo dentro del contenedor. */
  x: number;
  y: number;
}

export interface Camino {
  nodos: NodoDelCamino[];
  filas: number;
  columnas: number;
}

/**
 * Ubica `total` pasos en una serpentina de `columnas` columnas.
 *
 * Las filas impares van al revés: el paso siguiente queda siempre pegado al
 * anterior, que es lo que hace que se lea como un camino y no como una grilla.
 */
export function caminoDePasos(total: number, columnas = 5): Camino {
  const cols = Math.max(1, columnas);
  if (total <= 0) return { nodos: [], filas: 0, columnas: cols };

  const filas = Math.ceil(total / cols);
  const nodos: NodoDelCamino[] = [];

  for (let i = 0; i < total; i++) {
    const fila = Math.floor(i / cols);
    const enLaFila = i % cols;
    const columna = fila % 2 === 0 ? enLaFila : cols - 1 - enLaFila;
    nodos.push({
      i,
      fila,
      columna,
      x: ((columna + 0.5) / cols) * 100,
      y: ((fila + 0.5) / filas) * 100,
    });
  }

  return { nodos, filas, columnas: cols };
}

/**
 * Los puntos de la línea que une los nodos, en orden.
 *
 * Es la misma lista de centros: el componente la dibuja como una polilínea.
 * Se devuelve aparte porque la línea se pinta en dos capas —el tramo hecho y
 * el que falta— y así no hay que recalcular nada.
 */
export function puntosDelCamino(camino: Camino): { x: number; y: number }[] {
  return camino.nodos.map((n) => ({ x: n.x, y: n.y }));
}

/**
 * Hasta qué nodo está pintado el camino.
 *
 * Es el último paso hecho **sin saltos**: si el paso 3 está hecho y el 2 no, el
 * camino se pinta hasta el 1. La línea cuenta hasta dónde se llegó de verdad,
 * no cuántas casillas hay tildadas — para eso está el contador.
 */
export function avanceDelCamino(hechos: boolean[]): number {
  let n = 0;
  for (const h of hechos) {
    if (!h) break;
    n++;
  }
  return n;
}

/**
 * En qué paso está parada la cuenta: el primero sin hacer. Si están todos
 * hechos devuelve null — no hay "siguiente".
 */
export function pasoActual(hechos: boolean[]): number | null {
  const i = hechos.findIndex((h) => !h);
  return i === -1 ? null : i;
}
