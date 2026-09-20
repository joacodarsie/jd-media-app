/**
 * Las dos aprobaciones del calendario de contenidos.
 *
 * Pedido del 20/9: Luz aprueba de a un mes entero, no de a una pieza. Y son
 * dos momentos distintos, que hasta ahora estaban mezclados en el mismo select
 * de nueve estados:
 *
 * 1. **La idea.** Antes de que nadie diseñe nada. Se aprueba o se devuelve con
 *    correcciones escritas. Es barata de corregir: son dos líneas de texto.
 * 2. **La pieza terminada.** Antes de que salga al cliente. Acá el archivo es
 *    obligatorio: aprobar un diseño que nadie vio no es aprobar. Hasta ahora se
 *    podía marcar "Programado" con el campo del Drive vacío, y pasaba.
 *
 * Módulo PURO: entra la pieza, sale qué se puede hacer con ella.
 */

/** En qué momento del circuito está esperando una decisión. */
export type EtapaAprobacion = "idea" | "pieza";

export interface PiezaParaAprobar {
  estado: string;
  tipo?: string | null;
  asset_url?: string | null;
  link_instagram?: string | null;
}

/** Los tipos que produce edición y no diseño. */
const AUDIOVISUAL = new Set(["reel", "video"]);

/**
 * La etapa en la que la pieza espera una decisión, o null si no espera
 * ninguna (está en producción, ya salió, o está en manos del cliente).
 */
export function etapaDeAprobacion(p: PiezaParaAprobar): EtapaAprobacion | null {
  if (p.estado === "idea") return "idea";
  if (p.estado === "revision_creativa") return "pieza";
  return null;
}

/** A qué estado pasa la pieza cuando se aprueba. */
export function destinoAlAprobar(p: PiezaParaAprobar): string | null {
  const etapa = etapaDeAprobacion(p);
  if (etapa === "idea") {
    // Aprobar la idea es mandarla a producir: a edición si es audiovisual,
    // a diseño si no.
    return AUDIOVISUAL.has(p.tipo ?? "") ? "edicion" : "en_diseno";
  }
  // Aprobar la pieza terminada la programa y la deja en el Drive del cliente.
  if (etapa === "pieza") return "aprobado";
  return null;
}

/** ¿La pieza tiene cargado el archivo final (Drive, Canva o el posteo)? */
export function tieneArchivo(p: PiezaParaAprobar): boolean {
  return !!(p.asset_url?.trim() || p.link_instagram?.trim());
}

/**
 * Por qué no se puede aprobar todavía. null = se puede.
 *
 * La única traba es el archivo, y solo en la segunda aprobación: la idea se
 * aprueba leyéndola.
 */
export function motivoParaNoAprobar(p: PiezaParaAprobar): string | null {
  if (etapaDeAprobacion(p) === null) return "Esta pieza no está esperando una aprobación.";
  if (etapaDeAprobacion(p) === "pieza" && !tieneArchivo(p)) {
    return "Cargá el link del Drive o del Canva donde está la pieza: sin eso no se puede aprobar ni mandársela al cliente.";
  }
  return null;
}

/**
 * El candado del lado del servidor, para cualquier camino que lleve una pieza
 * a "Programado" (el botón, el select, el arrastre en el kanban, el bloque).
 *
 * No aplica a lo que viene del cliente ni a volver atrás desde "publicado":
 * eso ya pasó por acá una vez.
 */
export function motivoParaNoProgramar(input: {
  estadoNuevo: string;
  estadoAnterior: string;
  pieza: PiezaParaAprobar;
  /** El link que se está cargando en el mismo movimiento, si lo hay. */
  linkNuevo?: string | null;
}): string | null {
  if (input.estadoNuevo !== "aprobado") return null;
  if (input.estadoAnterior === "publicado") return null;
  // El cliente ya la vio y la aprobó él: el archivo se lo mandamos igual.
  if (input.estadoAnterior === "revision_cliente") return null;
  if (input.linkNuevo?.trim()) return null;
  if (tieneArchivo(input.pieza)) return null;
  return "Falta el link del Drive o del Canva con la pieza terminada. Cargalo y volvé a aprobar.";
}

export interface FilaAprobacion<T> {
  pieza: T;
  etapa: EtapaAprobacion;
}

/**
 * Separa las piezas que esperan decisión en los dos bloques de la pantalla.
 * Lo que no espera nada queda afuera: la pantalla es una bandeja, no un listado.
 */
export function bandejaDeAprobacion<T extends PiezaParaAprobar>(
  piezas: T[]
): { ideas: T[]; terminadas: T[] } {
  const ideas: T[] = [];
  const terminadas: T[] = [];
  for (const p of piezas) {
    const etapa = etapaDeAprobacion(p);
    if (etapa === "idea") ideas.push(p);
    else if (etapa === "pieza") terminadas.push(p);
  }
  return { ideas, terminadas };
}
