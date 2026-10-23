import { describe, expect, it } from "vitest";
import { ALTO, ANCHO, encuadrar, limpiarRecorte } from "./foto-gris";

/** Una «persona» de juguete: cabeza (círculo) arriba y hombros anchos abajo, hasta el borde. */
function persona(w: number, h: number, cxCabeza: number, extra?: [number, number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  const pintar = (x: number, y: number) => (px[(y * w + x) * 4 + 3] = 255);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const enCabeza = (x - cxCabeza) ** 2 + (y - 60) ** 2 <= 30 ** 2;
      const enCuerpo = y >= 95 && Math.abs(x - cxCabeza) <= 70;
      if (enCabeza || enCuerpo) pintar(x, y);
    }
  if (extra) for (let y = extra[1]; y < extra[3]; y++) for (let x = extra[0]; x < extra[2]; x++) pintar(x, y);
  return px;
}

describe("foto gris de la web", () => {
  it("centra la cabeza y la pone a la misma altura", () => {
    const e = encuadrar(persona(300, 400, 100), 300, 400)!;
    // Cabeza de 60 px de ancho → 21% del cuadro.
    expect(e.escala).toBeGreaterThan(3);
    const cabezaEnCuadro = 100 * e.escala + e.x;
    expect(Math.abs(cabezaEnCuadro - ANCHO / 2)).toBeLessThan(ANCHO * 0.03);
    expect(Math.abs(30 * e.escala + e.y - ALTO * 0.13)).toBeLessThan(ALTO * 0.02);
  });

  it("borra lo que no es la persona", () => {
    const w = 300;
    const h = 400;
    const px = persona(w, h, 150, [5, 300, 25, 340]);
    limpiarRecorte(px, w, h);
    expect(px[(320 * w + 10) * 4 + 3]).toBe(0);
    expect(px[(200 * w + 150) * 4 + 3]).toBe(255);
  });

  it("si la foto la corta de costado, ese costado se funde", () => {
    const w = 300;
    const h = 400;
    const px = persona(w, h, 150, [0, 100, 150, 400]);
    const r = limpiarRecorte(px, w, h);
    expect(r.tocaIzq).toBe(true);
    expect(r.tocaDer).toBe(false);
    expect(px[(200 * w + 0) * 4 + 3]).toBe(0);
    expect(px[(200 * w + 29) * 4 + 3]).toBeLessThan(255);
  });
});
