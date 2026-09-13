/**
 * Marcar una pieza como PUBLICADA exige el link del posteo.
 *
 * Por qué: al 13/9/2026 había **438 piezas publicadas y CERO con link**. Sin el
 * link no se puede abrir el posteo para verlo, ni medir qué repercusión tuvo, ni
 * ponerlo en el informe del cliente. "Publicado" sin link es una afirmación que
 * nadie puede comprobar — el mismo problema que tenían los cobros y la entrega.
 *
 * La app YA tiene seis columnas de link (`link_instagram`, `link_tiktok`,
 * `link_facebook`, `link_publicacion`, `publicacion_url`, `ig_permalink`). No se
 * agrega una séptima: alcanza con que haya UNO cargado en cualquiera de ellas.
 *
 * Puro a propósito: la regla se prueba sin base y sin sesión.
 */

export interface LinksDePieza {
  link_instagram?: string | null;
  link_tiktok?: string | null;
  link_facebook?: string | null;
  link_publicacion?: string | null;
  publicacion_url?: string | null;
  ig_permalink?: string | null;
}

/** Los campos donde puede estar el link, en orden de preferencia. */
const CAMPOS: (keyof LinksDePieza)[] = [
  "link_instagram",
  "ig_permalink",
  "link_tiktok",
  "link_facebook",
  "link_publicacion",
  "publicacion_url",
];

/** El primer link cargado de la pieza, o null si no hay ninguno. */
export function linkDePieza(p: LinksDePieza): string | null {
  for (const c of CAMPOS) {
    const v = p[c];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * ¿Es un link de posteo que se puede abrir?
 *
 * No valida que la red sea la correcta a propósito: una pieza puede salir en
 * TikTok, en LinkedIn o en un blog, y rechazar un link válido por no ser de
 * Instagram sería pelearse con quien está tratando de cargar el dato.
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

/** En qué campo guardar un link nuevo, según la red de la pieza. */
export function campoParaLink(red: string | null | undefined): keyof LinksDePieza {
  const r = (red ?? "").toLowerCase();
  if (r.includes("tiktok")) return "link_tiktok";
  if (r.includes("facebook")) return "link_facebook";
  return "link_instagram";
}
