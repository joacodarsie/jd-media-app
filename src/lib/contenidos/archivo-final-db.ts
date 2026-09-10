/**
 * El candado del archivo final, contra la base.
 *
 * La REGLA vive en `./archivo-final` y es pura. Acá está solamente el ir a
 * buscar la tarea y su pieza. Separado porque el candado tiene que aplicar en
 * los tres lugares desde donde se cierra una tarea —la pantalla, las acciones
 * en lote y JDmedIA— y si cada uno tuviera su copia, el primero que se olvide
 * abre la puerta de atrás.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { motivoParaNoCerrar, type PiezaDeLaTarea } from "./archivo-final";

/**
 * Devuelve el motivo por el que NO se pueden cerrar estas tareas (texto listo
 * para mostrar), o null si se puede.
 *
 * Ante cualquier error de consulta deja pasar: trabar a alguien por un problema
 * nuestro es peor que dejar una pieza sin archivo.
 */
export async function motivoParaNoCerrarTareas(
  sb: SupabaseClient,
  taskIds: string[],
  estadoNuevo: string
): Promise<string | null> {
  if (!taskIds.length) return null;

  const { data: tareas, error: errTareas } = await sb
    .from("tasks")
    .select("id, area, created_at")
    .in("id", taskIds);
  if (errTareas || !tareas?.length) return null;

  const { data: piezas, error: errPiezas } = await sb
    .from("publications")
    .select("task_id, titulo, tipo, publish_media, asset_url")
    .in("task_id", taskIds);
  // Sin la 0128 no existe publish_media: no hay candado que aplicar.
  if (errPiezas) return null;

  const porTarea = new Map(
    (piezas ?? []).map((p) => [(p as { task_id: string }).task_id, p as PiezaDeLaTarea])
  );

  for (const t of tareas as { id: string; area: string | null; created_at: string }[]) {
    const pieza = porTarea.get(t.id);
    const motivo = motivoParaNoCerrar(
      { area: t.area, creadaEn: t.created_at, publicationId: pieza ? t.id : null },
      pieza,
      estadoNuevo
    );
    if (motivo) return motivo;
  }
  return null;
}

/** Atajo para una sola tarea. */
export function motivoParaNoCerrarTarea(
  sb: SupabaseClient,
  taskId: string,
  estadoNuevo: string
): Promise<string | null> {
  return motivoParaNoCerrarTareas(sb, [taskId], estadoNuevo);
}
