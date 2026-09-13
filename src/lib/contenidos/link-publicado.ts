/**
 * Marcar una pieza como PUBLICADA exige el link del posteo.
 *
 * Por qué: al 13/9/2026 había **438 piezas publicadas y CERO con link**. Sin el
 * link no se puede abrir el posteo para verlo, ni medir qué repercusión tuvo, ni
 * ponerlo en el informe del cliente. "Publicado" sin link es una afirmación que
 * nadie puede comprobar — el mismo problema que tenían los cobros y la entrega.
 *
 * UN SOLO CAMPO: `link_instagram`. La tabla llegó a tener SEIS columnas de link
 * (`publicacion_url`, `link_publicacion`, `link_tiktok`, `link_facebook`,
 * `ig_permalink`) y cinco estaban vacías, con las 5 filas de `ig_permalink`
 * duplicadas en `link_instagram`. Se consolidaron en la migración 0167: es el
 * caso más claro del "información repetida" del backlog, y seis lugares para el
 * mismo dato significan que ninguno es confiable.
 *
 * Instagram es la red principal de planificación y la única que el dueño mira
 * para analizar repercusión, así que es la que queda.
 *
 * Puro a propósito: la regla se prueba sin base y sin sesión.
 */

export interface LinksDePieza {
  link_instagram?: string | null;
}

/** El link del posteo, o null si no hay. */
export function linkDePieza(p: LinksDePieza): string | null {
  const v = p.link_instagram;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * ¿Es un link de posteo que se puede abrir?
 *
 * No valida que el dominio sea de Instagram a propósito: una pieza puede salir
 * en otra red o en un blog, y rechazar un link válido por el dominio sería
 * pelearse con quien está tratando de cargar el dato.
 */
export function esLinkValido(url: string | null | undefined): boolean {
  if (!url) return false;
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    // Tiene que tener un host con punto: "http://foo" no lleva a ningún lado.
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Desde cuándo se exige el link.
 *
 * Las 438 piezas ya publicadas sin link se quedan como están: pedirles el link
 * hacia atrás sería trabar el trabajo de hoy por datos viejos que nadie va a
 * completar. Mismo criterio que se usó con el archivo final.
 */
export const LINK_OBLIGATORIO_DESDE = "2026-09-13";

export interface ChequeoLink {
  /** null = se puede publicar. Con texto = el motivo para frenar. */
  motivo: string | null;
}

/**
 * ¿Se puede pasar esta pieza a "publicado"?
 *
 * Solo aplica al estado `publicado`: los demás cambios de estado no piden nada.
 * Una pieza que YA estaba publicada tampoco: el candado es para el momento en
 * que se afirma que salió, no para editarla después.
 */
export function chequearLinkParaPublicar(input: {
  estadoNuevo: string;
  estadoAnterior: string;
  pieza: LinksDePieza;
  /** created_at de la pieza. Sin fecha se asume vieja y no se le exige nada. */
  creadaEn?: string | null;
  linkNuevo?: string | null;
}): ChequeoLink {
  if (input.estadoNuevo !== "publicado") return { motivo: null };
  if (input.estadoAnterior === "publicado") return { motivo: null };

  // Si vino un link, se valida SIEMPRE — incluso en una pieza vieja que está
  // exenta de tenerlo. La exención es para no exigir el dato, no para aceptar
  // uno roto: guardar un link inválido es peor que no guardar ninguno.
  const trajoLink =
    input.linkNuevo !== undefined && input.linkNuevo !== null && input.linkNuevo.trim() !== "";
  if (trajoLink && !esLinkValido(input.linkNuevo)) {
    return { motivo: "Ese link no parece una dirección válida. Tiene que empezar con https://" };
  }
  if (trajoLink) return { motivo: null };

  // Sin fecha se asume vieja y no se exige: que falte el dato es una falla
  // nuestra al leerlo, y trabar a alguien por eso es peor que dejar pasar una
  // pieza sin link.
  const creada = (input.creadaEn ?? "").slice(0, 10);
  if (!creada || creada < LINK_OBLIGATORIO_DESDE) return { motivo: null };

  if (linkDePieza(input.pieza)) return { motivo: null };

  return {
    motivo:
      "Falta el link del posteo. Sin él no se puede abrir la publicación ni medir qué repercusión tuvo.",
  };
}
