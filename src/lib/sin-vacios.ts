/**
 * Saca de cada fila las columnas en null antes de mandarla al navegador.
 *
 * Una pieza tiene más de 40 columnas y casi todas vienen vacías, pero el nombre
 * de cada una viaja igual: en /contenidos eran cientos de KB de `"x":null`
 * repetido en 1.100 filas (1/11/2026). Solo sirve para pantallas que leen los
 * campos con `?.` o `??`: si algo compara `=== null`, una columna ausente da
 * `undefined` y no entra.
 */
export function sinVacios<T extends object>(filas: T[]): T[] {
  return filas.map((fila) => {
    const limpia = { ...fila } as Record<string, unknown>;
    for (const k of Object.keys(limpia)) if (limpia[k] === null) delete limpia[k];
    return limpia as T;
  });
}
