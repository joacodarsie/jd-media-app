"use client";

/**
 * Arma la foto de la web en el navegador de quien la sube (23/10/2026): saca
 * el fondo con un modelo que corre en el propio navegador (no se manda la foto
 * a nadie), la pone sobre el gris del equipo y la encuadra como al resto. El
 * modelo se baja la primera vez (unos segundos) y queda en caché.
 */
import { ALTO, ANCHO, GRIS, encuadrar, limpiarRecorte } from "./foto-gris";

/** Más grande no mejora el recorte y tarda bastante más. */
const LADO_MAXIMO = 2000;

function lienzo(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("El navegador no deja dibujar la foto.");
  return { c, ctx };
}

export async function armarFotoGris(archivo: Blob, onProgreso?: (pct: number) => void): Promise<Blob> {
  // 1. La foto, achicada si es enorme (y derecha: respeta la orientación del celular).
  const original = await createImageBitmap(archivo);
  const k = Math.min(1, LADO_MAXIMO / Math.max(original.width, original.height));
  const ent = lienzo(Math.round(original.width * k), Math.round(original.height * k));
  ent.ctx.drawImage(original, 0, 0, ent.c.width, ent.c.height);
  const entrada = await new Promise<Blob>((ok, mal) => ent.c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo leer la foto."))), "image/png"));

  // 2. Sin fondo.
  const { removeBackground } = await import("@imgly/background-removal");
  const recorte = await removeBackground(entrada, {
    model: "medium",
    output: { format: "image/png" },
    progress: (clave: string, actual: number, total: number) => {
      if (onProgreso && clave.startsWith("fetch") && total) onProgreso(Math.round((actual / total) * 100));
    },
  });

  // 3. Solo la persona, encuadrada como el resto del equipo.
  const bm = await createImageBitmap(recorte);
  const rec = lienzo(bm.width, bm.height);
  rec.ctx.drawImage(bm, 0, 0);
  const img = rec.ctx.getImageData(0, 0, bm.width, bm.height);
  limpiarRecorte(img.data, bm.width, bm.height);
  rec.ctx.putImageData(img, 0, 0);
  const e = encuadrar(img.data, bm.width, bm.height);
  if (!e) throw new Error("No encontramos a nadie en la foto.");

  const sal = lienzo(ANCHO, ALTO);
  sal.ctx.fillStyle = `rgb(${GRIS.r}, ${GRIS.g}, ${GRIS.b})`;
  sal.ctx.fillRect(0, 0, ANCHO, ALTO);
  sal.ctx.imageSmoothingEnabled = true;
  sal.ctx.imageSmoothingQuality = "high";
  sal.ctx.drawImage(rec.c, e.x, e.y, bm.width * e.escala, bm.height * e.escala);
  return new Promise<Blob>((ok, mal) => sal.c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo guardar la foto."))), "image/webp", 0.86));
}
