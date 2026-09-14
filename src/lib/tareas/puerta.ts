/**
 * Las dos reglas del sistema de tickets, desde el 15/9/2026.
 *
 * 1. **Una sola puerta.** Todo lo de community, diseño y edición se le pide a
 *    la Project Manager, y es ella la que lo reparte. Antes cada uno le
 *    asignaba directo a quien le parecía, y la PM se enteraba tarde de la
 *    carga de su propio equipo.
 *
 * 2. **Nada de diseño llega al cliente sin la Directora Creativa.** Cuando una
 *    pieza de diseño o de edición pasa a "En revisión", la aprueba ella o pide
 *    cambios, y tiene 24 horas hábiles para responder.
 *
 * Las personas NO están acá: se resuelven por área (`Coordinación` y
 * `Coordinación de Diseño`), igual que el organigrama. Cambiar a quien ocupa
 * el puesto es cambiarle el área, no tocar código.
 *
 * Puro a propósito: se prueba sin base y sin sesión.
 */

/** Las áreas cuyo trabajo se le pide a la Project Manager. */
export const AREAS_DE_LA_PM = ["Community Manager", "Diseño", "Edición Audiovisual"];

/** Las áreas cuyo trabajo aprueba la Directora Creativa antes de ir al cliente. */
export const AREAS_CON_APROBACION = ["Diseño", "Edición Audiovisual"];

/** Las áreas de `users.area` que definen los dos puestos. */
export const AREA_PM = "Coordinación";
export const AREA_DIRECTORA = "Coordinación de Diseño";

/** Horas hábiles que tiene la Directora Creativa para responder. */
export const HORAS_PARA_APROBAR = 24;

export function vaPorLaPm(area: string | null | undefined): boolean {
  return AREAS_DE_LA_PM.includes(area ?? "");
}

export function requiereAprobacion(area: string | null | undefined): boolean {
  return AREAS_CON_APROBACION.includes(area ?? "");
}

export interface Actor {
  id: string;
  rol: string | null;
}

/**
 * ¿Esta persona puede asignarle un ticket de la PM a otra persona que no sea
 * la PM? Solo la PM (que reparte) y la dirección (que puede todo).
 */
export function puedeRepartir(actor: Actor, pmId: string | null): boolean {
  return actor.rol === "admin" || (!!pmId && actor.id === pmId);
}

/**
 * A quién le queda asignado un ticket o una subtarea al crearlo.
 *
 * Si el área va por la PM y quien lo crea no puede repartir, el pedido le
 * llega a la PM, sin importar a quién haya elegido. Si no hay PM cargada, se
 * respeta lo elegido: mejor un pedido directo que uno sin dueño.
 */
export function responsableAlCrear(input: {
  area: string | null | undefined;
  elegido: string | null;
  actor: Actor;
  pmId: string | null;
}): string | null {
  if (!vaPorLaPm(input.area) || !input.pmId) return input.elegido;
  if (puedeRepartir(input.actor, input.pmId)) return input.elegido;
  return input.pmId;
}

/**
 * Si un cambio de responsable está permitido. Devuelve el motivo si no.
 *
 * Asignárselo a la PM siempre se puede (es devolverlo a la puerta). Pasárselo a
 * otra persona, solo la PM o la dirección.
 */
export function motivoParaNoReasignar(input: {
  area: string | null | undefined;
  antes: string | null;
  despues: string | null;
  actor: Actor;
  pmId: string | null;
  pmNombre?: string | null;
}): string | null {
  if (input.antes === input.despues) return null;
  if (!vaPorLaPm(input.area) || !input.pmId) return null;
  if (input.despues === input.pmId) return null;
  if (puedeRepartir(input.actor, input.pmId)) return null;
  const pm = input.pmNombre?.split(" ")[0] ?? "la Project Manager";
  return `Los tickets de community, diseño y edición los reparte ${pm}. Si hay que cambiar el responsable, pedíselo a ella en un comentario.`;
}

// ─── Las 24 horas hábiles ────────────────────────────────────────────────────

const HORA = 3_600_000;
/** Córdoba es UTC-3 todo el año (Argentina no tiene horario de verano). */
const OFFSET_CBA = -3 * HORA;
/** Si la pieza entra un fin de semana, el reloj arranca el lunes a esta hora. */
const HORA_ARRANQUE_LUNES = 9;

/** Día de la semana en Córdoba: 0 domingo … 6 sábado. */
function diaCba(ms: number): number {
  return new Date(ms + OFFSET_CBA).getUTCDay();
}

/** Medianoche (en Córdoba) del día de `ms`, en ms UTC. */
function medianocheCba(ms: number): number {
  const local = ms + OFFSET_CBA;
  return local - (local % (24 * HORA)) - OFFSET_CBA;
}

/**
 * Cuándo vence la aprobación de algo que entró a revisión en `desde`.
 *
 * Cuenta solo horas de lunes a viernes: lo que entra el viernes a las 17 vence
 * el lunes a las 17. Lo que entra un sábado o domingo arranca a contar el lunes
 * a las 9, así vence el martes a las 9 y no un "martes 00:00" que nadie lee.
 * Los feriados no se descuentan: son pocos y agregarlos es mantener una lista.
 */
export function venceAprobacion(desde: string | Date, horas = HORAS_PARA_APROBAR): Date {
  let cursor = typeof desde === "string" ? Date.parse(desde) : desde.getTime();
  if (Number.isNaN(cursor)) throw new Error("Fecha inválida");

  const dia = diaCba(cursor);
  if (dia === 6 || dia === 0) {
    const diasHastaLunes = dia === 6 ? 2 : 1;
    cursor = medianocheCba(cursor) + diasHastaLunes * 24 * HORA + HORA_ARRANQUE_LUNES * HORA;
  }

  let resta = horas * HORA;
  while (resta > 0) {
    const d = diaCba(cursor);
    if (d === 6 || d === 0) {
      cursor = medianocheCba(cursor) + 24 * HORA;
      continue;
    }
    const finDelDia = medianocheCba(cursor) + 24 * HORA;
    const tramo = Math.min(resta, finDelDia - cursor);
    cursor += tramo;
    resta -= tramo;
  }
  return new Date(cursor);
}

export interface EstadoAprobacion {
  vence: Date;
  vencida: boolean;
  /** "vence hoy 17:00", "vence lun 21/9 17:00", "vencida hace 5 h". */
  texto: string;
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function horaCba(ms: number): string {
  const d = new Date(ms + OFFSET_CBA);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function estadoAprobacion(desde: string, ahora: Date = new Date()): EstadoAprobacion {
  const vence = venceAprobacion(desde);
  const v = vence.getTime();
  const a = ahora.getTime();
  if (a > v) {
    const horas = Math.floor((a - v) / HORA);
    const texto =
      horas < 1 ? "vencida hace minutos" : horas < 48 ? `vencida hace ${horas} h` : `vencida hace ${Math.floor(horas / 24)} días`;
    return { vence, vencida: true, texto };
  }
  const mismoDia = medianocheCba(v) === medianocheCba(a);
  const l = new Date(v + OFFSET_CBA);
  const cuando = mismoDia
    ? "hoy"
    : `${DIAS[l.getUTCDay()]} ${l.getUTCDate()}/${l.getUTCMonth() + 1}`;
  return { vence, vencida: false, texto: `vence ${cuando} ${horaCba(v)}` };
}

export interface TareaEsperando {
  id: string;
  titulo: string;
  aprobador_id: string | null;
  revision_desde: string | null;
}

export interface AvisoAprobacion {
  userId: string;
  mensaje: string;
  link: string;
}

/**
 * El aviso diario de las aprobaciones que se pasaron de las 24 horas hábiles.
 *
 * A quien aprueba, un recordatorio con todo lo que tiene atrasado. A la PM y a
 * la dirección, lo mismo pero dicho como problema: si la aprobación se traba,
 * la pieza no llega al cliente y eso es tiempo de la PM.
 */
export function avisosDeAprobacionVencida(
  tareas: TareaEsperando[],
  personas: { pmId: string | null; adminIds: string[] },
  nombreAprobadora: (id: string) => string,
  ahora: Date = new Date()
): AvisoAprobacion[] {
  const vencidas = tareas.filter(
    (t) => t.aprobador_id && t.revision_desde && estadoAprobacion(t.revision_desde, ahora).vencida
  );
  if (!vencidas.length) return [];

  const porAprobadora = new Map<string, TareaEsperando[]>();
  for (const t of vencidas) {
    const lista = porAprobadora.get(t.aprobador_id!) ?? [];
    lista.push(t);
    porAprobadora.set(t.aprobador_id!, lista);
  }

  const avisos: AvisoAprobacion[] = [];
  const nombrar = (l: TareaEsperando[]) =>
    l.length === 1 ? `"${l[0].titulo}"` : `${l.length} piezas (la primera, "${l[0].titulo}")`;

  for (const [aprobadora, lista] of porAprobadora) {
    const link = lista.length === 1 ? `/tareas/${lista[0].id}` : "/tareas";
    avisos.push({
      userId: aprobadora,
      link,
      mensaje: `⏳ Se pasó el plazo de 24 h hábiles para aprobar ${nombrar(lista)}.`,
    });
    const quien = nombreAprobadora(aprobadora).split(" ")[0];
    const avisados = new Set([aprobadora]);
    for (const uid of [personas.pmId, ...personas.adminIds]) {
      if (!uid || avisados.has(uid)) continue;
      avisados.add(uid);
      avisos.push({
        userId: uid,
        link,
        mensaje: `⏳ ${quien} tiene ${nombrar(lista)} esperando aprobación hace más de 24 h hábiles. No llega al cliente.`,
      });
    }
  }
  return avisos;
}

// ─── "Qué te toca" en cada ticket ────────────────────────────────────────────

export type Papel = "responsable" | "pm" | "directora" | "otro";

export interface TicketParaGuia {
  area: string | null;
  estado: string;
  asignado_a_id: string | null;
  creado_por_id: string | null;
  aprobador_id: string | null;
  parent_id: string | null;
}

/**
 * Qué papel cumple quien mira el ticket. Si cumple más de uno, manda el que
 * tiene algo que hacer AHORA: aprobar antes que repartir, repartir antes que
 * producir.
 */
export function papelEnTicket(
  t: TicketParaGuia,
  yo: string,
  pmId: string | null,
  directoraId: string | null
): Papel {
  const aprobadora = t.aprobador_id ?? (requiereAprobacion(t.area) ? directoraId : null);
  if (aprobadora === yo && t.estado === "en_revision") return "directora";
  if (pmId === yo && vaPorLaPm(t.area) && t.asignado_a_id === yo) return "pm";
  if (t.asignado_a_id === yo) return "responsable";
  // La directora fuera de revisión no tiene nada que hacer todavía, y
  // la PM que ya repartió no tiene nada que hacer en el ticket: si se le
  // siguiera mostrando "te toca repartir", aprendería a ignorar el recuadro.
  return "otro";
}

export interface Paso {
  texto: string;
  hecho: boolean;
  /** El paso en el que está parado el ticket. */
  actual: boolean;
}

const ESTADOS_ORDEN = ["pendiente", "en_progreso", "en_revision", "completada"];

function marcar(textos: [string, number][], estado: string): Paso[] {
  const idx = Math.max(0, ESTADOS_ORDEN.indexOf(estado === "archivada" ? "completada" : estado));
  const pasos = textos.map(([texto, hastaEstado]) => ({
    texto,
    hecho: idx > hastaEstado || estado === "completada" || estado === "archivada",
    actual: false,
  }));
  const primero = pasos.findIndex((p) => !p.hecho);
  if (primero >= 0) pasos[primero].actual = true;
  return pasos;
}

/**
 * Los pasos de quien mira el ticket, en el orden en que se hacen. Cortos a
 * propósito: si no entran en una línea, no los lee nadie.
 */
export function pasosDelTicket(
  t: TicketParaGuia,
  papel: Papel,
  nombres: { pm: string; directora: string }
): { titulo: string; pasos: Paso[] } | null {
  const conAprobacion = requiereAprobacion(t.area);
  const esMadre = !t.parent_id;

  if (papel === "directora") {
    return {
      titulo: "Te toca aprobar",
      pasos: marcar(
        [
          ["Mirá la pieza: el archivo final está en la pieza del calendario o en la carpeta del ticket.", 2],
          ["Aprobala, o pedí cambios diciendo exactamente qué corregir.", 2],
          ["Tenés 24 horas hábiles desde que entró a revisión.", 2],
        ],
        t.estado === "en_revision" ? "en_revision" : t.estado
      ),
    };
  }

  if (papel === "pm") {
    return {
      titulo: "Te toca repartir",
      pasos: [
        { texto: esMadre ? "Revisá que el pedido esté completo: detalle, referencias y fecha." : "Revisá que el pedido esté completo.", hecho: false, actual: true },
        { texto: esMadre ? "Asigná cada subtarea a quien la va a hacer, con su fecha de entrega." : "Asignala a quien la va a hacer, con su fecha de entrega.", hecho: false, actual: false },
        { texto: "Si falta información, pedila en un comentario antes de repartir.", hecho: false, actual: false },
      ],
    };
  }

  if (papel === "responsable") {
    if (conAprobacion) {
      return {
        titulo: "Te toca producir",
        pasos: marcar(
          [
            ["Pasalo a En progreso cuando empieces.", 0],
            ["Subí el archivo final a la pieza del calendario o a la carpeta del ticket.", 1],
            [`Pasalo a En revisión: le llega a ${nombres.directora} para aprobar.`, 1],
            ["Esperá la aprobación. Si pide cambios, corregí y volvé a pasarlo a En revisión.", 2],
          ],
          t.estado
        ),
      };
    }
    return {
      titulo: "Te toca hacerlo",
      pasos: marcar(
        [
          ["Pasalo a En progreso cuando empieces.", 0],
          ["Si algo te frena, pasalo a Bloqueada y contá por qué en un comentario.", 1],
          ["Cuando esté listo, pasalo a Completada.", 1],
        ],
        t.estado
      ),
    };
  }

  return null;
}
