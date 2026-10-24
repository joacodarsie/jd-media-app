/**
 * Trae TODAS las filas de una consulta, de a 1.000 (24/10/2026). La base no
 * devuelve más de 1.000 por pedido y lo corta sin avisar: al 24/10 ya había
 * 1.443 tareas y 1.050 publicaciones, y varias pantallas perdían filas.
 *
 * `armar(desde, hasta)` tiene que devolver la consulta con `.range(desde, hasta)`
 * y un orden estable (por ejemplo, terminar en `.order("id")`).
 */
export async function todasLasFilas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maximo = 20_000
): Promise<{ data: T[]; error: unknown }> {
  const todas: T[] = [];
  for (let desde = 0; desde < maximo; desde += 1000) {
    const { data, error } = await armar(desde, desde + 999);
    if (error) return { data: todas, error };
    todas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: todas, error: null };
}
