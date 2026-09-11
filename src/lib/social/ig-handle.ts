/**
 * Normaliza el @ de Instagram que se carga a mano.
 *
 * Existe porque el dato llega de todas las formas posibles: pegado como URL
 * completa desde el navegador, con el @ adelante, con la barra final, o con un
 * espacio invisible del copiar y pegar. Si eso entra crudo a la ficha, después
 * no matchea con lo que devuelve Meta y la cuenta queda sin conectar sin que se
 * entienda por qué.
 */

/** Un usuario de Instagram: letras, números, punto y guión bajo, hasta 30. */
const VALIDO = /^[A-Za-z0-9._]{1,30}$/;

export interface HandleNormalizado {
  ok: boolean;
  /** El usuario sin @, en minúsculas. Solo cuando `ok`. */
  handle?: string;
  /** La URL del perfil, para guardar en `instagram_url`. Solo cuando `ok`. */
  url?: string;
  error?: string;
}

export function normalizarHandle(valor: string | null | undefined): HandleNormalizado {
  let v = (valor ?? "").trim();
  if (!v) return { ok: false, error: "Escribí el usuario de Instagram." };

  // Viene pegado como link: nos quedamos con el primer tramo de la ruta, que
  // descarta también el ?igsh=... que agrega la app al compartir.
  const comoUrl = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (comoUrl) v = comoUrl[1];

  v = v.replace(/^@+/, "").replace(/\/+$/, "").trim().toLowerCase();

  if (!v) return { ok: false, error: "Escribí el usuario de Instagram." };
  if (!VALIDO.test(v)) {
    return {
      ok: false,
      error: "Ese usuario no parece válido: solo letras, números, punto y guión bajo.",
    };
  }
  return { ok: true, handle: v, url: `https://www.instagram.com/${v}/` };
}
