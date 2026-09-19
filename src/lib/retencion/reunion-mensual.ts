/**
 * La reunión mensual con el cliente, generada sola todos los meses.
 *
 * Por qué existe: al 13/9/2026 la agencia tenía 12 cuentas activas y **9 nunca
 * habían tenido una reunión mensual registrada**. Las otras 3 tenían la última
 * en julio o agosto. La pantalla para darla existe desde el 4/8 (guión con IA,
 * diagnóstico del mes, semáforo) y nadie entraba.
 *
 * Y eso pega justo donde duele: de las 7 bajas de los últimos 3 meses, ninguna
 * pasó de 3,2 meses. Un cliente que nunca se sienta a ver qué se hizo con su
 * plata se va antes de que haya resultados para mostrar. La reunión no es un
 * trámite: es el único momento en que el cliente ve el trabajo.
 *
 * La lección de la prospección vale igual acá: la función estaba construida y
 * no tenía dueño ni fecha. Esto le pone las dos cosas.
 *
 * Todo el módulo es PURO: entra data, sale qué tickets faltan. Sin base ni red.
 */

/** Día del mes en que debería estar dada la reunión del período. */
export const DIA_LIMITE_REUNION = 10;

/** Día del mes a partir del cual se le avisa al dueño quién sigue sin darla. */
export const DIA_ESCALA_REUNION = 15;

export interface ClienteParaReunion {
  id: string;
  nombre: string;
  estado: string;
  es_interno: boolean | null;
  /** Community manager de la cuenta, si tiene. */
  cm_id: string | null;
  /**
   * Quien responde por la cuenta (acuerdo del 16/9/2026). Si lo hay, la
   * reunión es suya: es lo que cobra con el 5% de cartera. Si no, la da la PM.
   */
  responsable_id?: string | null;
}

export interface ReunionRegistrada {
  cliente_id: string;
  periodo: string;
}

export interface TareaDeReunion {
  titulo: string;
  descripcion: string;
  cliente_id: string;
  asignado_a_id: string;
  area: string;
  prioridad: string;
  fecha_limite: string;
}

/**
 * El título es la clave de deduplicación: mismo texto = misma reunión. Se sigue
 * el patrón de los gastos fijos (`conceptoDeSuscripcion`), que ya probó que
 * alcanza para que el cron corra mil veces sin duplicar.
 */
export function tituloReunion(nombreCliente: string, periodo: string): string {
  return `Reunión mensual — ${nombreCliente} — ${periodo}`;
}

/** "2026-09-13" → "2026-09". */
export function periodoDe(ymd: string): string {
  return ymd.slice(0, 7);
}

/** Suma días a una fecha "YYYY-MM-DD" leyendo los dígitos (sin `new Date`). */
export function sumarDias(ymd: string, dias: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Cuándo vence la reunión del período.
 *
 * Normalmente el 10. Pero si el ticket se crea tarde (la primera corrida, o un
 * cliente que se dio de alta a mitad de mes) el 10 ya pasó, y una tarea que
 * nace vencida se ignora desde el primer día. En ese caso se dan 3 días.
 */
export function fechaLimiteReunion(periodo: string, hoy: string): string {
  const limite = `${periodo}-${String(DIA_LIMITE_REUNION).padStart(2, "0")}`;
  return limite >= hoy ? limite : sumarDias(hoy, 3);
}

function descripcion(
  nombre: string,
  periodo: string,
  clienteId: string,
  cmNombre: string | null
): string {
  return `La reunión de seguimiento de **${nombre}** por el período ${periodo}.${
    cmNombre ? `\n\nEl CM de la cuenta es **${cmNombre}**: que te pase lo que haya que mostrar y esté en la reunión si hace falta.` : ""
  }

Todo el material sale solo en **Clientes → ${nombre} → Reunión mensual** (/clientes/${clienteId}/reunion): el guión del meet, qué se publicó, qué rindió y el semáforo del mes. No hay que preparar nada a mano.

Después de darla, **registrala ahí mismo** con lo que salió. Si no queda registrada, para la agencia no existió y el mes que viene el ticket vuelve igual.

Por qué importa: de las últimas 7 cuentas que se fueron, **ninguna pasó de 3 meses**. No se van por los resultados —a los dos meses todavía no hay resultados— se van porque nunca se sientan a ver el trabajo. Esta reunión es ese momento.`;
}

/**
 * Qué tickets de reunión faltan crear para el período.
 *
 * Se saltean: las cuentas internas, las que no están activas, las que ya tienen
 * la reunión registrada, y las que ya tienen el ticket abierto.
 */
export function reunionesFaltantes(input: {
  clientes: ClienteParaReunion[];
  registradas: ReunionRegistrada[];
  titulosExistentes: string[];
  /**
   * Quién DA la reunión. Es la project manager, no el CM de cada cuenta:
   * decisión del user del 10/9 ("la reunión mensual la da Luz, con Guille y
   * Brisa presentes"). Va contra la tentación de repartirla entre los CM —
   * toda la reestructura salió de que nadie respondía por el resultado de una
   * cuenta, y darle la reunión estratégica al CM reconstruye ese agujero.
   * El CM igual figura en la descripción: prepara el material y participa.
   *
   * Desde el 16/9/2026 hay una excepción: si la cuenta tiene `responsable_id`,
   * la reunión es de esa persona — es la que cobra el 5% de cartera por
   * atenderla, y ese 5% depende justamente de que la reunión se dé.
   */
  responsable: string;
  /** id → nombre, para nombrar al CM en la descripción. */
  nombrePorId?: Record<string, string | undefined>;
  hoy: string;
}): TareaDeReunion[] {
  const { clientes, registradas, titulosExistentes, responsable, nombrePorId, hoy } = input;
  const periodo = periodoDe(hoy);
  const yaDada = new Set(registradas.filter((r) => r.periodo === periodo).map((r) => r.cliente_id));
  const yaPedida = new Set(titulosExistentes);
  const fecha = fechaLimiteReunion(periodo, hoy);

  return clientes
    .filter((c) => c.estado === "activo" && !c.es_interno)
    .filter((c) => !yaDada.has(c.id))
    .filter((c) => !yaPedida.has(tituloReunion(c.nombre, periodo)))
    .map((c) => ({
      titulo: tituloReunion(c.nombre, periodo),
      descripcion: descripcion(
        c.nombre,
        periodo,
        c.id,
        (c.cm_id && nombrePorId?.[c.cm_id]) || null
      ),
      cliente_id: c.id,
      asignado_a_id: c.responsable_id || responsable,
      area: "Coordinación",
      prioridad: "alta",
      fecha_limite: fecha,
    }));
}

/**
 * Pasado el día 15, qué cuentas activas siguen sin reunión registrada del mes.
 *
 * Es el aviso al dueño. Un ticket vencido ya avisa a su responsable, pero la
 * reunión que no se da no se nota hasta que el cliente se va: por eso escala.
 */
export function reunionesAtrasadas(input: {
  clientes: ClienteParaReunion[];
  registradas: ReunionRegistrada[];
  hoy: string;
}): ClienteParaReunion[] {
  const { clientes, registradas, hoy } = input;
  if (+hoy.slice(8, 10) < DIA_ESCALA_REUNION) return [];
  const periodo = periodoDe(hoy);
  const yaDada = new Set(registradas.filter((r) => r.periodo === periodo).map((r) => r.cliente_id));
  return clientes.filter((c) => c.estado === "activo" && !c.es_interno && !yaDada.has(c.id));
}

/** El texto del aviso al dueño. Corto: es una campana, no un informe. */
export function avisoAtrasadas(pendientes: ClienteParaReunion[], periodo: string): string {
  const n = pendientes.length;
  const nombres = pendientes.slice(0, 4).map((c) => c.nombre).join(", ");
  const resto = n > 4 ? ` y ${n - 4} más` : "";
  return `⚠️ Reuniones de ${periodo} sin dar: ${n} cuenta${n === 1 ? "" : "s"} (${nombres}${resto}). Es el mes que el cliente no vio su trabajo.`;
}
