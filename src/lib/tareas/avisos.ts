/**
 * Qué cambios de una tarea merecen un aviso, y a quién.
 *
 * Del pedido del 13/9: "Jira te buchonea, que me notifique cualquier cambio".
 *
 * Pero "cualquier cambio" es exactamente el error de Jira: la queja número uno
 * de sus usuarios es que notifica tanto que todos filtran los mails y dejan de
 * leerlos. Un aviso que se ignora es peor que no tenerlo, porque además tapa
 * al que sí importaba. Así que acá se avisa poco y bien:
 *
 *  - Te asignaron algo → ya lo avisa un trigger de la base; NO se duplica acá.
 *  - Cambió la fecha de algo tuyo → te cambia el día.
 *  - Cambió el estado → solo a los que siguen el ticket, no al que lo tocó.
 *
 * Y NUNCA se le avisa a quien hizo el cambio: ya lo sabe, lo acaba de hacer.
 * Ese es el aviso inútil que entrena a ignorar la campanita.
 *
 * Puro: se prueba sin base y sin sesión.
 */

export interface EstadoTarea {
  asignado_a_id: string | null;
  fecha_limite: string | null;
  estado: string;
  prioridad: string;
  titulo: string;
}

export type TipoAviso = "fecha" | "estado";

export interface Aviso {
  userId: string;
  tipo: TipoAviso;
  mensaje: string;
}

/** Formatea una fecha ISO como "18/09". Null → "sin fecha". */
function dm(iso: string | null): string {
  if (!iso) return "sin fecha";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Los avisos que genera un cambio.
 *
 * @param antes      Cómo estaba la tarea.
 * @param despues    Cómo quedó.
 * @param autorId    Quién hizo el cambio. Nunca recibe aviso.
 * @param seguidores Quiénes siguen el ticket además del responsable.
 */
export function avisosDeCambio(
  antes: EstadoTarea,
  despues: EstadoTarea,
  autorId: string,
  seguidores: string[] = []
): Aviso[] {
  const out: Aviso[] = [];
  const titulo = despues.titulo || antes.titulo || "una tarea";

  // ── La ASIGNACIÓN no se avisa desde acá ──
  //
  // Ya la avisa un trigger de la base (`notify_assignment`, migración 0001) que
  // cubre TODOS los caminos: el alta, la edición, la reasignación en bloque y
  // cualquier escritura directa. Mandar otro aviso desde el código le llegaba a
  // la persona duplicado — verificado el 13/9 con una tarea de prueba.
  const cambioAsignado = antes.asignado_a_id !== despues.asignado_a_id;

  // ── Te cambiaron la fecha ──
  //
  // Solo si la tarea YA era tuya: si en el mismo movimiento te la asignaron,
  // el aviso de asignación ya trae la fecha y mandar dos es ruido.
  const cambioFecha = antes.fecha_limite !== despues.fecha_limite;
  if (cambioFecha && !cambioAsignado && despues.asignado_a_id && despues.asignado_a_id !== autorId) {
    out.push({
      userId: despues.asignado_a_id,
      tipo: "fecha",
      mensaje: `Cambió la entrega de "${titulo}": ${dm(antes.fecha_limite)} → ${dm(
        despues.fecha_limite
      )}`,
    });
  }

  // ── Cambió el estado: solo para los que siguen el ticket ──
  //
  // Al responsable no se le avisa: en la enorme mayoría de los casos el cambio
  // de estado lo hace él mismo, y cuando no, lo ve al entrar.
  if (antes.estado !== despues.estado) {
    for (const s of seguidores) {
      if (s === autorId) continue;
      if (s === despues.asignado_a_id) continue;
      out.push({
        userId: s,
        tipo: "estado",
        mensaje: `"${titulo}" pasó a ${despues.estado.replace(/_/g, " ")}`,
      });
    }
  }

  // Una persona, un aviso por cambio: si le tocan dos cosas a la vez, se manda
  // el primero (el más importante por el orden de arriba).
  const vistos = new Set<string>();
  return out.filter((a) => {
    if (vistos.has(a.userId)) return false;
    vistos.add(a.userId);
    return true;
  });
}
