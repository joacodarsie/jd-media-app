// Links de referencia de una tarea: lo que se carga en el formulario pasa por
// acá antes de guardarse. Módulo puro.

import type { TaskLink } from "@/lib/types";

/** Una fila del formulario, como la escribe la persona. */
export interface LinkBorrador {
  label: string;
  url: string;
}

/**
 * Limpia los links de un formulario:
 *  - descarta las filas sin URL (una fila vacía es una fila que no se usó);
 *  - agrega https:// si falta ("drive.google.com/..." es un link válido para el equipo);
 *  - si no hay nombre, usa el dominio, así la lista nunca muestra una URL cruda;
 *  - descarta duplicados por URL.
 *
 * Devuelve `error` con la primera URL que no se puede interpretar, para
 * avisarle a quien carga en vez de guardar algo roto.
 */
export function normalizarLinks(filas: LinkBorrador[]): { links: TaskLink[]; error?: string } {
  const links: TaskLink[] = [];
  const vistas = new Set<string>();
  for (const f of filas) {
    const crudo = f.url.trim();
    if (!crudo) continue;
    const conProtocolo = /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`;
    let url: URL;
    try {
      url = new URL(conProtocolo);
    } catch {
      return { links: [], error: `El link "${crudo}" no parece una dirección válida.` };
    }
    if (!url.hostname.includes(".")) {
      return { links: [], error: `El link "${crudo}" no parece una dirección válida.` };
    }
    const href = url.toString();
    if (vistas.has(href)) continue;
    vistas.add(href);
    links.push({ label: f.label.trim() || url.hostname.replace(/^www\./, ""), url: href });
  }
  return { links };
}
