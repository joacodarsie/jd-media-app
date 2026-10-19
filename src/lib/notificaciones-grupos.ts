/**
 * La campanita junta los avisos repetidos (18/10/2026): muchos recordatorios
 * se mandan todos los días con el mismo texto (cambian solo los números) y
 * tapaban todo lo demás. Dos avisos son «el mismo» si coinciden el tipo, la
 * tarea y el texto sin números. Se muestra el más nuevo con cuántas veces vino.
 */
export interface NotiBase {
  id: string;
  tipo: string;
  mensaje: string;
  task_id: string | null;
  leida: boolean;
  created_at: string;
}

export interface GrupoNoti<T extends NotiBase> {
  /** El más nuevo del grupo: es el que se muestra. */
  principal: T;
  ids: string[];
  veces: number;
  sinLeer: number;
}

export const claveNoti = (n: NotiBase) =>
  `${n.tipo}|${n.task_id ?? ""}|${n.mensaje.replace(/[\d.,$]+/g, "#").replace(/\s+/g, " ").trim().toLowerCase()}`;

export function agruparNotificaciones<T extends NotiBase>(items: T[]): GrupoNoti<T>[] {
  const grupos = new Map<string, GrupoNoti<T>>();
  for (const n of [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = claveNoti(n);
    const g = grupos.get(k);
    if (!g) grupos.set(k, { principal: n, ids: [n.id], veces: 1, sinLeer: n.leida ? 0 : 1 });
    else {
      g.ids.push(n.id);
      g.veces++;
      if (!n.leida) g.sinLeer++;
    }
  }
  return [...grupos.values()];
}
