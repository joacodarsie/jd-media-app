import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Todos los contactos de prospección, de a 1.000.
 *
 * La base corta cada consulta en 1.000 filas. Con 2.048 contactos cargados
 * (5/10/2026) la mitad quedaba afuera del control de repetidos, y el mismo
 * número volvía a entrar con otro nombre ("Barbería Club de Caballeros" y
 * "Barbería Club Mendoza", el mismo 261 333-6969).
 */
export async function todosLosContactos<T>(admin: SupabaseClient, columnas: string): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin
      .from("prospecting_contacts")
      .select(columnas)
      .order("created_at", { ascending: true })
      .range(desde, desde + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
