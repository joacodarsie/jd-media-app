/**
 * El "Pool de talento" es una búsqueda singleton (es_pool=true) donde viven
 * todos los CVs analizados contra todas las áreas. Get-or-create para reutilizar
 * la misma fila siempre.
 */
import type { createAdmin } from "@/lib/supabase/admin";

export const POOL_TITULO = "Pool de talento";

/** Devuelve el id del pool. Puede lanzar (ej: si falta la migración 0098). */
export async function getOrCreatePoolSearch(
  admin: ReturnType<typeof createAdmin>
): Promise<string> {
  const { data, error } = await admin
    .from("recruitment_searches")
    .select("id")
    .eq("es_pool", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return (data as { id: string }).id;

  const { data: created, error: insErr } = await admin
    .from("recruitment_searches")
    .insert({ titulo: POOL_TITULO, area: null, es_pool: true, estado: "abierta" })
    .select("id")
    .single();
  if (insErr || !created) throw insErr ?? new Error("No se pudo crear el pool.");
  return (created as { id: string }).id;
}
