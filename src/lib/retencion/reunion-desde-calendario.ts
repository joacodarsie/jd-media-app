/**
 * Reconocer en el calendario la reunión mensual que ya se dio.
 *
 * El ticket de la reunión se crea solo y, al completarlo, la reunión queda
 * registrada (trigger `jd_task_to_meeting`, migración 0182). Pero el que la da
 * casi nunca vuelve a la app a cerrarla: en septiembre de 2026 había 16 tickets
 * abiertos y 2 reuniones registradas.
 *
 * Esto cierra ese hueco desde el otro lado: si en el calendario de la agencia
 * hubo un evento con el nombre del cliente y **ya pasó**, la reunión se da por
 * dada. El trigger de la 0182 completa el ticket solo.
 *
 * Es deliberadamente conservador: el evento tiene que nombrar al cliente y
 * sonar a reunión, y tiene que haber empezado ya. Un evento agendado para
 * mañana no cuenta, y uno cancelado tampoco.
 *
 * Módulo PURO: entra la lista de eventos y las cuentas, sale qué registrar.
 */

/** Lo que hace falta de un evento del calendario. */
export interface EventoCalendario {
  id: string;
  summary: string;
  /** ISO. Si el evento arranca en el futuro, no se cuenta. */
  start: string;
  status?: string;
}

export interface CuentaParaMatch {
  id: string;
  nombre: string;
}

export interface ReunionDetectada {
  cliente_id: string;
  periodo: string;
  /** Día del evento, YYYY-MM-DD. */
  fecha: string;
  /** Qué evento la disparó: queda escrito en la nota. */
  evento: string;
}

/** Sin acentos, minúsculas y con los espacios normalizados. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palabras que hacen que un evento suene a reunión con el cliente. Sin esto,
 * un evento llamado solo "Magic" (una grabación, un recordatorio) contaría
 * como reunión.
 */
const PALABRAS = ["reunion", "meet", "mensual", "seguimiento", "call", "videollamada"];

/** ¿Este evento es la reunión mensual de esta cuenta? */
export function eventoEsReunion(evento: EventoCalendario, nombreCuenta: string): boolean {
  if (evento.status === "cancelled") return false;
  const titulo = normalizar(evento.summary ?? "");
  if (!titulo) return false;
  const cuenta = normalizar(nombreCuenta);
  // Nombres muy cortos ("Magic" está bien, "JD" no) darían falsos positivos.
  if (cuenta.length < 4) return false;
  if (!titulo.includes(cuenta)) return false;
  return PALABRAS.some((p) => titulo.includes(p));
}

/**
 * Qué reuniones del período se pueden dar por dadas mirando el calendario.
 *
 * Se saltean las cuentas que ya tienen la reunión registrada: esto solo
 * completa lo que falta, nunca pisa lo que alguien cargó a mano.
 */
export function reunionesDesdeCalendario(input: {
  eventos: EventoCalendario[];
  cuentas: CuentaParaMatch[];
  /** Cuentas que ya tienen reunión registrada en el período. */
  yaRegistradas: string[];
  periodo: string;
  /** Ahora, en ISO. Un evento que todavía no empezó no cuenta. */
  ahora: string;
}): ReunionDetectada[] {
  const { eventos, cuentas, yaRegistradas, periodo, ahora } = input;
  const ya = new Set(yaRegistradas);
  const out: ReunionDetectada[] = [];

  for (const c of cuentas) {
    if (ya.has(c.id)) continue;
    const match = eventos
      .filter((e) => (e.start ?? "").slice(0, 7) === periodo)
      .filter((e) => e.start <= ahora)
      .filter((e) => eventoEsReunion(e, c.nombre))
      // Si hubo varias, vale la última: es la que refleja el estado del mes.
      .sort((a, b) => a.start.localeCompare(b.start))
      .pop();
    if (!match) continue;
    out.push({
      cliente_id: c.id,
      periodo,
      fecha: match.start.slice(0, 10),
      evento: match.summary,
    });
    ya.add(c.id);
  }

  return out;
}
