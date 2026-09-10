/**
 * El archivo final es parte de entregar la pieza, no un paso opcional.
 *
 * Por qué existe: la app tiene autopublicación a Instagram y Facebook desde
 * julio, y en 60 días se usó 5 veces. No porque falle: de 255 piezas
 * publicadas, sólo 31 tenían el archivo en la app y NINGUNA tenía el archivo
 * final cargado, que es lo único que la autopublicación necesita. El caño
 * estaba seco en el origen — el equipo produce en Canva y publica del celular,
 * así que subir el archivo era un paso extra que nadie hacía.
 *
 * Con esto, diseño y edición no pueden dar por terminada la tarea de una pieza
 * sin dejar el archivo adentro. Es el único cambio que hace que la
 * autopublicación (y el "¿salió de verdad?") tengan de qué agarrarse.
 *
 * Puro a propósito: la regla se prueba sin base y sin sesión.
 */

/** Las áreas cuyo entregable ES el archivo. Al CM no se le pide nada. */
export const AREAS_QUE_ENTREGAN_ARCHIVO = ["Diseño", "Edición Audiovisual"];

/**
 * Solo "completada" pide archivo. Archivar es abandonar la pieza (se canceló,
 * el cliente la frenó, se duplicó): exigir un entregable para eso dejaría
 * tareas muertas imposibles de sacar del medio.
 */
const ESTADOS_DE_CIERRE = ["completada"];

/**
 * Desde cuándo se pide el archivo.
 *
 * El día que se prendió esto había 141 tareas de diseño/edición abiertas, 114
 * de ellas sin archivo — 46 de Carlos, 26 de Darío. Aplicarlo a todas habría
 * sido levantar un paredón en la cara del equipo por trabajo que ya venían
 * haciendo con las reglas viejas. Las de antes se cierran como siempre; el
 * candado corre para las tareas nuevas.
 */
export const ARCHIVO_OBLIGATORIO_DESDE = "2026-09-11";

export interface TareaParaCerrar {
  area: string | null;
  /** created_at de la tarea. Sin fecha, se asume vieja y no se le exige nada. */
  creadaEn?: string | null;
  /** La pieza del calendario que produce esta tarea, si es de una pieza. */
  publicationId?: string | null;
}

export interface PiezaDeLaTarea {
  titulo: string | null;
  tipo: string;
  /** Los archivos finales subidos a la app. Lo que mira la autopublicación. */
  publish_media?: { path: string; name: string }[] | null;
  /** Un link externo (Drive, Canva). Sirve para mirarlo, no para publicarlo. */
  asset_url?: string | null;
}

/** ¿La pieza tiene el archivo adentro de la app? */
export function tieneArchivoFinal(pieza: PiezaDeLaTarea | null | undefined): boolean {
  return !!pieza?.publish_media?.length;
}

/** ¿A esta tarea le corresponde entregar un archivo? */
export function entregaArchivo(tarea: TareaParaCerrar): boolean {
  if (!tarea.publicationId) return false;
  if (!AREAS_QUE_ENTREGAN_ARCHIVO.includes(tarea.area ?? "")) return false;
  const creada = tarea.creadaEn?.slice(0, 10);
  return !!creada && creada >= ARCHIVO_OBLIGATORIO_DESDE;
}

/**
 * El motivo por el que NO se puede cerrar la tarea, listo para mostrar, o null
 * si se puede. El texto dice qué hacer: un "falta el archivo" a secas manda a
 * preguntar, y el que produce no tiene por qué saber cómo se llama el campo.
 */
export function motivoParaNoCerrar(
  tarea: TareaParaCerrar,
  pieza: PiezaDeLaTarea | null | undefined,
  estadoNuevo: string
): string | null {
  if (!ESTADOS_DE_CIERRE.includes(estadoNuevo)) return null;
  if (!entregaArchivo(tarea)) return null;
  if (tieneArchivoFinal(pieza)) return null;

  const conLink = !!pieza?.asset_url?.trim();
  const cual = pieza?.titulo?.trim() ? `"${pieza.titulo.trim()}"` : "la pieza";
  return conLink
    ? `Para cerrar esta tarea falta subir el archivo final de ${cual}. El link que dejaste sirve para verla, pero la app necesita el archivo adentro para publicarla sola. Abrí la pieza en el calendario y tocá "Subir archivo final".`
    : `Para cerrar esta tarea falta subir el archivo final de ${cual}. Abrí la pieza en el calendario y tocá "Subir archivo final": subí lo que va a salir publicado.`;
}
