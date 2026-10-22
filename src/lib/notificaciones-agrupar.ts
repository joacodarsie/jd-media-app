/**
 * Avisos agrupados (22/10/2026).
 *
 * En una semana Luz recibió 209 avisos y tenía 277 sin leer; Guille 138, Santi
 * 128. Más de la mitad eran «Vence mañana» / «Tarea vencida» de tareas que se
 * crean de a muchas juntas (las de vincular Instagram de 13 cuentas, por
 * ejemplo): un aviso por tarea. Con 30 avisos por día la campana deja de
 * mirarse y se pierde lo importante.
 *
 * Regla: si a una persona le tocan más de MAX_SUELTOS avisos del mismo tipo en
 * una corrida, va UNO solo con el total y los primeros títulos, que lleva a
 * Tareas. Si son pocos, siguen yendo uno por tarea (con el link a la tarea).
 * Puro: entran los avisos que se iban a crear, salen los que se crean.
 */

export const MAX_SUELTOS = 3;

export interface AvisoTarea {
  user_id: string;
  task_id: string;
  tipo: string;
  mensaje: string;
  /** El título de la tarea, para armar el resumen. */
  titulo: string;
}

export interface AvisoFinal {
  user_id: string;
  task_id: string | null;
  tipo: string;
  mensaje: string;
  link?: string;
}

const ENCABEZADO: Record<string, (n: number) => string> = {
  vencida: (n) => `⏰ Tenés ${n} tareas vencidas`,
  proxima_a_vencer: (n) => `📅 ${n} tareas vencen hoy o mañana`,
};

export function agruparAvisos(avisos: AvisoTarea[], max = MAX_SUELTOS): AvisoFinal[] {
  const porClave = new Map<string, AvisoTarea[]>();
  for (const a of avisos) {
    const k = `${a.user_id}|${a.tipo}`;
    porClave.set(k, [...(porClave.get(k) ?? []), a]);
  }
  const out: AvisoFinal[] = [];
  for (const grupo of porClave.values()) {
    if (grupo.length <= max || !ENCABEZADO[grupo[0].tipo]) {
      for (const a of grupo) out.push({ user_id: a.user_id, task_id: a.task_id, tipo: a.tipo, mensaje: a.mensaje });
      continue;
    }
    const titulos = grupo.slice(0, 2).map((a) => `«${a.titulo.length > 40 ? a.titulo.slice(0, 39) + "…" : a.titulo}»`);
    const resto = grupo.length - titulos.length;
    out.push({
      user_id: grupo[0].user_id,
      task_id: null,
      tipo: grupo[0].tipo,
      mensaje: `${ENCABEZADO[grupo[0].tipo](grupo.length)}: ${titulos.join(", ")}${resto > 0 ? ` y ${resto} más` : ""}.`,
      link: "/tareas",
    });
  }
  return out;
}
