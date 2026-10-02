/**
 * Quién ve las ideas del calendario que todavía no aprobó el director creativo.
 *
 * Pedido de Luz y Santi (2/10/2026): diseño y edición ven el calendario recién
 * cuando está aprobado. Una idea sin aprobar todavía se puede cambiar o
 * descartar: si diseño la ve, arranca a trabajar sobre algo que no está firme.
 * La tarea de producción también nace recién al aprobar (migración 0187).
 *
 * Ven las ideas los que arman y aprueban el calendario: dirección,
 * coordinación (Luz, Santi) y los CMs.
 */

export const VEN_IDEAS = ["admin", "coordinador", "community_manager"];

export function puedeVerIdeas(u: { rol: string; rol_secundario?: string | null }): boolean {
  return VEN_IDEAS.includes(u.rol) || (!!u.rol_secundario && VEN_IDEAS.includes(u.rol_secundario));
}

/** Saca las ideas sin aprobar para quien no las tiene que ver. */
export function sinIdeasParaProduccion<T extends { estado: string }>(
  pubs: T[],
  u: { rol: string; rol_secundario?: string | null }
): T[] {
  return puedeVerIdeas(u) ? pubs : pubs.filter((p) => p.estado !== "idea");
}
