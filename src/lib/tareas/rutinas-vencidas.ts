import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Las rutinas de un período que ya terminó se archivan solas (1/11/2026). Una
 * «ronda de la semana del 19/10» o el rojo de octubre no se pueden hacer tarde:
 * cada período genera las suyas, y las viejas solo ensuciaban las vencidas.
 * La encuesta y los pasos de arranque no entran: esos siguen valiendo.
 */
const RUTINA_DE_PERIODO = /^(?:dir:|ref:momento:.*:|rojo:.*:)(\d{4}-\d{2})(?:-\d{2})?(?::|$)|^(\d{4}-\d{2}):gads:/;

export function periodoDeRutina(clave: string): string | null {
  const m = clave.match(RUTINA_DE_PERIODO);
  return m ? (m[1] ?? m[2]) : null;
}

export async function archivarRutinasVencidas(admin: SupabaseClient, hoy: string): Promise<number> {
  const mes = hoy.slice(0, 7);
  const { data } = await admin
    .from("tasks")
    .select("id, rutina_key")
    .not("rutina_key", "is", null)
    .not("estado", "in", "(completada,archivada)")
    .lt("fecha_limite", hoy);
  const ids = ((data ?? []) as { id: string; rutina_key: string }[])
    .filter((t) => {
      const p = periodoDeRutina(t.rutina_key);
      return !!p && p < mes;
    })
    .map((t) => t.id);
  if (!ids.length) return 0;
  await admin.from("tasks").update({ estado: "archivada", fecha_completada: new Date().toISOString() }).in("id", ids);
  return ids.length;
}
