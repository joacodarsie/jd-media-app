/**
 * Imágenes livianas para jdmedia.com.ar (21/10/2026). Los logos y las fotos de
 * las grillas se subían en tamaño original (hasta 1,3 MB un logo que se ve de
 * 120 px) y el inicio pesaba ~20 MB en el celular. Supabase las achica al
 * vuelo con el endpoint de transformación (y las sirve en WebP si el navegador
 * lo acepta): 469 KB → 31 KB un logo.
 */
const PUBLICO = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";

/** La versión achicada de una URL pública del storage de Supabase; cualquier otra queda igual. */
export function imagenChica(url: string, ancho: number): string {
  if (!url.includes(".supabase.co" + PUBLICO) || url.includes("?")) return url;
  // resize=contain: sin esto Supabase deja el alto original y RECORTA (un logo de
  // 2000×2000 salía 240×2000: se veía solo el centro, y las grillas con zoom).
  return `${url.replace(PUBLICO, RENDER)}?width=${ancho}&height=${ancho}&resize=contain&quality=72`;
}

/** Recorre una respuesta y achica todas las URLs del storage que encuentre. */
export function achicarImagenes<T>(valor: T, ancho: number): T {
  if (typeof valor === "string") return imagenChica(valor, ancho) as T;
  if (Array.isArray(valor)) return valor.map((v) => achicarImagenes(v, ancho)) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, achicarImagenes(v, ancho)])) as T;
  }
  return valor;
}
