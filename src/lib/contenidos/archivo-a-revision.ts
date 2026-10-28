/**
 * Pegar el link del archivo final pasa la pieza a revisión creativa (28/10/2026).
 *
 * Por qué: la tarea de diseño/edición se cierra sola cuando la PIEZA avanza
 * (trigger `jd_sync_pub_to_task`), pero nadie movía la pieza: quedaba en
 * «En diseño» hasta que se publicaba. En 30 días, 120 de las 142 tareas de
 * piezas «cerradas tarde» se cerraron DESPUÉS de que el posteo ya había salido
 * (6,4 días después, en promedio), y ninguna pasó por revisión. El trabajo
 * salía a tiempo; el registro no. Pegar el archivo es la señal real de
 * «terminé», así que la pieza avanza sola.
 */

/** Etapas de producción: de acá, con el archivo listo, sigue la revisión. */
const EN_PRODUCCION = new Set(["en_diseno", "guion", "edicion", "rechazado"]);

/**
 * A qué estado pasa la pieza cuando se guarda el link del archivo, o null si
 * se queda donde está. Una idea todavía no aprobada no avanza: primero la
 * aprueba la dirección creativa. Borrar el link tampoco mueve nada.
 */
export function estadoAlPegarArchivo(
  estadoActual: string,
  linkAnterior: string | null | undefined,
  linkNuevo: string | null | undefined
): "revision_creativa" | null {
  const nuevo = linkNuevo?.trim();
  if (!nuevo) return null;
  if (nuevo === (linkAnterior ?? "").trim()) return null;
  return EN_PRODUCCION.has(estadoActual) ? "revision_creativa" : null;
}
