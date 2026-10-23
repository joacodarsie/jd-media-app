/**
 * La foto de la web con fondo gris (23/10/2026). El dueño pidió que todo el
 * equipo se vea igual en jdmedia.com.ar: mismo gris, la cabeza a la misma
 * altura y del mismo tamaño, la persona centrada. A mano quedó así para las 12
 * fotos de entonces; esto es la misma receta para las que se suban después.
 *
 * Entra la persona ya recortada (RGBA, con el fondo transparente) y sale dónde
 * va en el cuadro. Puro: lo usa Mi perfil en el navegador y se testea acá.
 */

export const ANCHO = 1000;
export const ALTO = 1250;
export const GRIS = { r: 214, g: 214, b: 212 };
/** Ancho de la cabeza respecto del cuadro. */
const CABEZA = 0.21;
/** Altura donde arranca la cabeza. */
const ARRIBA = 0.13;

/**
 * Se queda solo con la persona: la mancha más grande (afuera radiadores,
 * pedazos de pared, sillas sueltas). Si la foto la corta de costado, ese
 * costado se funde con el gris en vez de quedar un corte recto. Modifica `px`.
 */
export function limpiarRecorte(px: Uint8ClampedArray, w: number, h: number): { tocaIzq: boolean; tocaDer: boolean } {
  const comp = new Int32Array(w * h).fill(-1);
  const tam: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] <= 128 || comp[i] >= 0) continue;
    const id = tam.length;
    let n = 0;
    const pila = [i];
    comp[i] = id;
    while (pila.length) {
      const k = pila.pop()!;
      n++;
      const x = k % w;
      const y = (k - x) / w;
      const vecinos = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const v of vecinos) {
        if (v < 0 || comp[v] >= 0 || px[v * 4 + 3] <= 128) continue;
        comp[v] = id;
        pila.push(v);
      }
    }
    tam.push(n);
  }
  const mayor = tam.indexOf(Math.max(...tam));
  for (let i = 0; i < w * h; i++) if (comp[i] >= 0 && comp[i] !== mayor) px[i * 4 + 3] = 0;

  const tocaCol = (x: number) => {
    let n = 0;
    for (let y = 0; y < h * 0.85; y++) if (px[(y * w + x) * 4 + 3] > 128) n++;
    return n > h * 0.03;
  };
  const tocaIzq = tocaCol(0);
  const tocaDer = tocaCol(w - 1);
  const banda = Math.round(w * 0.1);
  for (let y = 0; y < h; y++)
    for (let k = 0; k < banda; k++) {
      const f = (k / banda) ** 1.5;
      if (tocaIzq) px[(y * w + k) * 4 + 3] *= f;
      if (tocaDer) px[(y * w + (w - 1 - k)) * 4 + 3] *= f;
    }
  return { tocaIzq, tocaDer };
}

export interface Encuadre {
  /** Escala a aplicar al recorte. */
  escala: number;
  /** Dónde va la esquina del recorte escalado dentro del cuadro. */
  x: number;
  y: number;
}

/**
 * Dónde va la persona: busca la cabeza (de arriba hacia abajo, hasta que el
 * ancho salta a los hombros), la pone al centro y a la misma altura que el
 * resto, y si la foto termina cortada abajo, se asegura de que llegue al borde.
 */
export function encuadrar(px: Uint8ClampedArray, w: number, h: number): Encuadre | null {
  const fila = (y: number): [number, number] | null => {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 128) {
        if (a < 0) a = x;
        b = x;
      }
    return a < 0 ? null : [a, b];
  };
  let top = 0;
  for (; top < h; top++) {
    const r = fila(top);
    if (r && r[1] - r[0] >= 6) break;
  }
  if (top >= h) return null;
  let ancho = 0;
  let cx = w / 2;
  for (let y = top; y < h; y++) {
    const r = fila(y);
    if (!r) continue;
    const a = r[1] - r[0];
    if (y - top > 25 && a > 1.7 * ancho) break;
    if (a > ancho) {
      ancho = a;
      cx = (r[0] + r[1]) / 2;
    }
  }
  let bottom = h - 1;
  while (bottom > 0 && !fila(bottom)) bottom--;
  let escala = (CABEZA * ANCHO) / Math.max(ancho, 1);
  const yTop = ARRIBA * ALTO;
  if (bottom >= h - 3 && yTop + (h - top) * escala < ALTO) escala = (ALTO - yTop) / (h - top);
  return { escala, x: Math.round(ANCHO / 2 - cx * escala), y: Math.round(yTop - top * escala) };
}
