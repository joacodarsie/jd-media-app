/**
 * La lista de campañas de prospección: buscar y ordenar.
 *
 * Pedido del dueño (5/10/2026): las campañas estaban en carpetas por rubro y,
 * cuando crea una nueva o vuelve a una que usó ayer, tiene que buscarla entre
 * todas. Ahora arranca por las usadas recientemente: la última vez que se abrió
 * o que se trabajó un contacto, lo que haya pasado después.
 *
 * Puro, para probarlo sin base.
 */

export type OrdenCampanias = "uso" | "nuevas" | "nombre" | "rubro";

export const ORDENES_CAMPANIAS: { value: OrdenCampanias; label: string }[] = [
  { value: "uso", label: "Usadas recientemente" },
  { value: "nuevas", label: "Más nuevas" },
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "rubro", label: "Por rubro (carpetas)" },
];

export interface CampaniaLista {
  id: string;
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  created_at: string;
  /** ISO de la última vez que se abrió o se trabajó. */
  ultimoUso: string;
}

/** La más reciente de las fechas que haya (ISO). */
export function ultimoUso(creada: string, fechas: (string | null | undefined)[]): string {
  let max = creada;
  for (const f of fechas) if (f && f > max) max = f;
  return max;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Busca por nombre, rubro o zona, sin importar tildes ni mayúsculas. */
export function filtrarCampanias<T extends CampaniaLista>(lista: T[], q: string): T[] {
  const t = norm(q.trim());
  if (!t) return lista;
  return lista.filter((c) => norm(`${c.nombre} ${c.rubro} ${c.ubicacion ?? ""}`).includes(t));
}

export function ordenarCampanias<T extends CampaniaLista>(lista: T[], orden: OrdenCampanias): T[] {
  const copia = [...lista];
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  if (orden === "nombre") return copia.sort(porNombre);
  if (orden === "nuevas") return copia.sort((a, b) => b.created_at.localeCompare(a.created_at) || porNombre(a, b));
  if (orden === "rubro")
    return copia.sort(
      (a, b) =>
        (a.rubro || "").localeCompare(b.rubro || "", "es") ||
        (a.ubicacion ?? "").localeCompare(b.ubicacion ?? "", "es") ||
        porNombre(a, b)
    );
  return copia.sort((a, b) => b.ultimoUso.localeCompare(a.ultimoUso) || porNombre(a, b));
}

/** "hoy", "ayer", "hace 5 días", "hace 3 meses". */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const dias = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}
