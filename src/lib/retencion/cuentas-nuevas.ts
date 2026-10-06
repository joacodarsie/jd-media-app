/**
 * El tablero de las cuentas nuevas: los primeros 90 días de cada cliente.
 *
 * Por qué existe (6/10/2026): la agencia llegó a 20 cuentas, pero 9 entraron en
 * septiembre y ninguna de las bajas de la historia pasó de 3,2 meses. Las
 * señales ya existían repartidas (Arranques, el semáforo del Director, los
 * tickets de reunión, Finanzas) y nadie las cruzaba para las cuentas que más
 * riesgo tienen. Acá se leen juntas, con las cinco preguntas que deciden si
 * una cuenta nueva se queda:
 *
 *   1. ¿Se terminó el arranque de 15 días?
 *   2. ¿Ya vio publicada su primera pieza?
 *   3. ¿Tiene la reunión del mes dada o agendada?
 *   4. ¿Pagó?
 *   5. ¿Tiene el equipo completo?
 *
 * Módulo PURO: entra la data, sale el tablero ordenado por riesgo.
 */
import { diasEntre } from "./onboarding-pendiente";
import { sumarDias } from "./onboarding-15";
import { DIA_LIMITE_REUNION } from "./reunion-mensual";

/** Cuántos días se mira una cuenta como "nueva". */
export const DIAS_CUENTA_NUEVA = 90;

/** Desde qué día de la cuenta preocupa no tener ninguna pieza publicada. */
export const DIA_PRIMERA_PIEZA = 21;

/** Día de la cuenta en que se agenda sola la reunión del primer mes. */
export const DIA_REUNION_PRIMER_MES = 28;

export type Estado = "ok" | "atento" | "mal";

export interface CuentaNuevaCruda {
  id: string;
  nombre: string;
  /** "YYYY-MM-DD" */
  fechaInicio: string;
  monto: number | null;
  cmId: string | null;
  disenadorId: string | null;
  audiovisualId: string | null;
  /** Tiene gestión de redes activa. Sin redes (branding, web) no se le piden
   *  piezas ni equipo de contenido. Si falta el dato se asume que sí. */
  conRedes?: boolean;
  /** Progreso del arranque de 15 días (null = no tiene plan). */
  arranque: { hechos: number; total: number; atrasados: number; terminado: boolean } | null;
  /** "YYYY-MM-DD" de la primera pieza publicada, si hay. */
  primeraPublicada: string | null;
  /** Piezas de este mes que siguen en "idea" (sin aprobar por dirección creativa). */
  ideasSinAprobar?: number;
  /** Ya se registró la reunión de este mes. */
  reunionHecha: boolean;
  /** "YYYY-MM-DD" de la próxima reunión agendada con la cuenta, si hay. */
  reunionAgendada: string | null;
  /** Cobros: facturas emitidas y los meses ("YYYY-MM") con alguna vencida sin
   *  marcar como cobrada. Se cuenta por mes y no por factura: un mes con
   *  redes + WhatsApp + chatter son tres facturas y una sola deuda. */
  facturas: number;
  mesesSinCobrar: string[];
  /** Semáforo del Director (plan, puntualidad, tareas, portal, encuesta). */
  salud: "bien" | "regular" | "mal" | null;
  alertasSalud: string[];
}

export interface Chequeo {
  clave: "arranque" | "pieza" | "reunion" | "cobro" | "equipo";
  label: string;
  estado: Estado;
  detalle: string;
}

export interface CuentaNueva {
  id: string;
  nombre: string;
  fechaInicio: string;
  /** Día de la cuenta (1 = el día que arrancó). */
  dia: number;
  /** 1, 2 o 3. */
  mes: number;
  estado: Estado;
  chequeos: Chequeo[];
  /** Lo que dice el semáforo del Director, para no repetir lo de los chequeos. */
  alertas: string[];
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const PESO: Record<Estado, number> = { ok: 0, atento: 1, mal: 3 };

function fechaCorta(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** Las cuentas que todavía están en sus primeros 90 días. */
export function esCuentaNueva(fechaInicio: string | null, hoy: string): boolean {
  if (!fechaInicio) return false;
  const d = diasEntre(fechaInicio.slice(0, 10), hoy);
  return d >= 0 && d < DIAS_CUENTA_NUEVA;
}

function chequeoArranque(c: CuentaNuevaCruda, dia: number): Chequeo {
  const label = "Arranque de 15 días";
  const a = c.arranque;
  if (!a || a.total === 0) {
    return {
      clave: "arranque",
      label,
      estado: dia > 3 ? "mal" : "atento",
      detalle: "Sin plan de arranque",
    };
  }
  if (a.terminado) return { clave: "arranque", label, estado: "ok", detalle: "Terminado" };
  const detalle = `${a.hechos} de ${a.total} pasos`;
  if (a.atrasados > 0)
    return {
      clave: "arranque",
      label,
      // Pasos atrasados en la primera semana son normales; pasado el arranque
      // (o con medio plan atrasado) ya no.
      estado: dia > 15 || a.atrasados >= 5 ? "mal" : "atento",
      detalle: `${detalle} · ${a.atrasados} atrasado${a.atrasados === 1 ? "" : "s"}`,
    };
  return { clave: "arranque", label, estado: "ok", detalle };
}

function chequeoPieza(c: CuentaNuevaCruda, dia: number): Chequeo {
  const label = "Primera pieza publicada";
  if (c.primeraPublicada)
    return {
      clave: "pieza",
      label,
      estado: "ok",
      detalle: `El ${fechaCorta(c.primeraPublicada)}`,
    };
  const ideas = c.ideasSinAprobar ?? 0;
  const base = dia >= 14 ? `Todavía nada, día ${dia}` : "Todavía no (es normal hasta la semana 3)";
  return {
    clave: "pieza",
    label,
    estado: dia >= DIA_PRIMERA_PIEZA ? "mal" : dia >= 14 ? "atento" : "ok",
    detalle: ideas > 0 && dia >= 14 ? `${base} · ${ideas} sin aprobar` : base,
  };
}

function chequeoReunion(c: CuentaNuevaCruda, dia: number, hoy: string): Chequeo {
  const label = "Reunión del mes";
  if (c.reunionHecha) return { clave: "reunion", label, estado: "ok", detalle: "Hecha" };
  if (c.reunionAgendada) {
    const vencida = c.reunionAgendada < hoy;
    return {
      clave: "reunion",
      label,
      estado: vencida ? "mal" : "ok",
      detalle: vencida
        ? `Era el ${fechaCorta(c.reunionAgendada)} y no se registró`
        : `Agendada el ${fechaCorta(c.reunionAgendada)}`,
    };
  }
  // Mes 1: la de cierre, hacia el día 28. Después: la mensual, que vence el 10.
  const tarde = dia <= 30 ? dia >= DIA_REUNION_PRIMER_MES : +hoy.slice(8, 10) > DIA_LIMITE_REUNION;
  return { clave: "reunion", label, estado: tarde ? "mal" : "atento", detalle: "Sin agendar" };
}

function chequeoCobro(c: CuentaNuevaCruda): Chequeo {
  const label = "Cobro";
  if (c.facturas === 0) return { clave: "cobro", label, estado: "atento", detalle: "Sin factura emitida" };
  const meses = c.mesesSinCobrar;
  if (meses.length === 0) return { clave: "cobro", label, estado: "ok", detalle: "Al día" };
  const nombres = [...meses].sort().map((m) => MESES[+m.slice(5, 7) - 1]);
  return {
    clave: "cobro",
    label,
    estado: meses.length >= 2 ? "mal" : "atento",
    detalle: `Sin marcar como cobrado: ${nombres.join(" y ")}`,
  };
}

function chequeoEquipo(c: CuentaNuevaCruda, dia: number): Chequeo {
  const label = "Equipo asignado";
  const faltan = [
    !c.cmId && "community manager",
    !c.disenadorId && "diseño",
    !c.audiovisualId && "edición",
  ].filter(Boolean) as string[];
  if (faltan.length === 0) return { clave: "equipo", label, estado: "ok", detalle: "Completo" };
  return {
    clave: "equipo",
    label,
    // Sin CM no hay quien publique; sin edición puede ser un pack sin videos.
    // Los primeros días es normal que el equipo se esté asignando.
    estado: !c.cmId && dia > 5 ? "mal" : "atento",
    detalle: `Falta ${faltan.join(", ")}`,
  };
}

// Las alertas del semáforo que ya cuenta un chequeo de acá: no se repiten.
const YA_CONTADO = /reunión mensual/i;

export function armarCuentaNueva(c: CuentaNuevaCruda, hoy: string): CuentaNueva {
  const inicio = c.fechaInicio.slice(0, 10);
  const dia = diasEntre(inicio, hoy) + 1;
  const redes = c.conRedes !== false;
  // Una cuenta que ya pasó el primer mes sin plan de arranque es anterior a
  // que existiera (21/9/2026): ese chequeo ya no le dice nada.
  const sinArranqueViejo = (!c.arranque || c.arranque.total === 0) && dia > 30;
  const chequeos = [
    ...(sinArranqueViejo ? [] : [chequeoArranque(c, dia)]),
    ...(redes ? [chequeoPieza(c, dia)] : []),
    chequeoReunion(c, dia, hoy),
    chequeoCobro(c),
    ...(redes ? [chequeoEquipo(c, dia)] : []),
  ];
  // La cuenta toma el color de su peor chequeo. El semáforo del Director solo
  // la puede llevar a "atento": sus alertas (tareas vencidas, portal) se
  // muestran abajo, pero no alcanzan para decir que la cuenta está en riesgo.
  const peor = Math.max(...chequeos.map((x) => PESO[x.estado]));
  const estado: Estado =
    peor >= PESO.mal ? "mal" : peor >= PESO.atento || c.salud === "mal" || c.salud === "regular" ? "atento" : "ok";
  return {
    id: c.id,
    nombre: c.nombre,
    fechaInicio: inicio,
    dia,
    mes: Math.min(3, Math.floor((dia - 1) / 30) + 1),
    estado,
    chequeos,
    alertas: c.alertasSalud.filter((a) => !YA_CONTADO.test(a)),
  };
}

/** El tablero: peor estado primero y, a igual estado, la más nueva arriba. */
export function tableroCuentasNuevas(cuentas: CuentaNuevaCruda[], hoy: string): CuentaNueva[] {
  const orden: Record<Estado, number> = { mal: 0, atento: 1, ok: 2 };
  return cuentas
    .filter((c) => esCuentaNueva(c.fechaInicio, hoy))
    .map((c) => armarCuentaNueva(c, hoy))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || a.dia - b.dia);
}

export function resumenCuentasNuevas(filas: CuentaNueva[]) {
  return {
    total: filas.length,
    mal: filas.filter((f) => f.estado === "mal").length,
    atento: filas.filter((f) => f.estado === "atento").length,
    ok: filas.filter((f) => f.estado === "ok").length,
  };
}

// ── La reunión que se agenda sola ──────────────────────────────────────────

export interface ReunionAAgendar {
  clienteId: string;
  titulo: string;
  /** "YYYY-MM-DD" (día hábil). */
  fecha: string;
}

function diaHabil(ymd: string): string {
  let d = ymd;
  for (let i = 0; i < 3; i++) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) return d;
    d = sumarDias(d, 1);
  }
  return d;
}

export function tituloReunionAgenda(nombre: string, mes: number): string {
  return mes === 1 ? `Reunión de cierre del primer mes — ${nombre}` : `Reunión mensual — ${nombre}`;
}

/**
 * Qué cuentas nuevas necesitan que se les agende la reunión.
 *
 * - Mes 1: el día 28 de la cuenta (cierre del primer mes, con algo publicado
 *   para mostrar).
 * - Meses 2 y 3: el 10 del mes, que es cuando vence la reunión mensual.
 *
 * Nunca antes de pasado mañana, para que haya tiempo de avisarle al cliente.
 * Se saltea la cuenta si ya tiene la reunión del mes dada o una agendada desde
 * el primer día de este mes (la mueven arrastrando en la Agenda si el cliente
 * pide otro día).
 */
export function reunionesAAgendar(cuentas: CuentaNuevaCruda[], hoy: string): ReunionAAgendar[] {
  const minimo = sumarDias(hoy, 2);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const out: ReunionAAgendar[] = [];
  for (const c of cuentas) {
    if (!esCuentaNueva(c.fechaInicio, hoy)) continue;
    if (c.reunionHecha) continue;
    if (c.reunionAgendada && c.reunionAgendada >= inicioMes) continue;
    const inicio = c.fechaInicio.slice(0, 10);
    const dia = diasEntre(inicio, hoy) + 1;
    const mes = Math.min(3, Math.floor((dia - 1) / 30) + 1);
    const objetivo = mes === 1 ? sumarDias(inicio, DIA_REUNION_PRIMER_MES - 1) : `${hoy.slice(0, 7)}-10`;
    const fecha = diaHabil(objetivo < minimo ? minimo : objetivo);
    out.push({ clienteId: c.id, titulo: tituloReunionAgenda(c.nombre, mes), fecha });
  }
  return out;
}

// ── El aviso de la mañana ──────────────────────────────────────────────────

/** Cómo se nombra cada chequeo en el aviso (corto: va al celular). */
const CORTO: Record<Chequeo["clave"], string> = {
  arranque: "arranque",
  pieza: "publicado",
  reunion: "reunión",
  cobro: "cobro",
  equipo: "equipo",
};

export const PREFIJO_AVISO = "🚦 Cuentas nuevas en riesgo";

/** Cuántas cuentas se nombran en el aviso antes de cortar con "y N más". */
const MAX_EN_AVISO = 4;

/**
 * El aviso diario a la dirección creativa y a la PM: solo las cuentas en
 * riesgo y solo lo que está mal de cada una, para que se lea en el celular.
 * null = no hay ninguna en riesgo (ese día no se avisa nada).
 */
export function avisoCuentasEnRiesgo(filas: CuentaNueva[]): string | null {
  // Primero las que tienen más cosas mal y, a igual cantidad, las más viejas:
  // una cuenta de tres semanas sin nada publicado pesa más que un arranque
  // atrasado de la primera semana.
  const malas = (f: CuentaNueva) => f.chequeos.filter((c) => c.estado === "mal").length;
  const mal = filas
    .filter((f) => f.estado === "mal")
    .sort((a, b) => malas(b) - malas(a) || b.dia - a.dia);
  if (mal.length === 0) return null;
  const partes = mal.slice(0, MAX_EN_AVISO).map((f) => {
    const que = f.chequeos
      .filter((c) => c.estado === "mal")
      .map((c) => `${CORTO[c.clave]}: ${c.detalle.charAt(0).toLowerCase()}${c.detalle.slice(1)}`)
      .join("; ");
    return `${f.nombre} (día ${f.dia}) → ${que}`;
  });
  const resto = mal.length - MAX_EN_AVISO;
  return `${PREFIJO_AVISO} (${mal.length}): ${partes.join(" · ")}${resto > 0 ? ` · y ${resto} más` : ""}.`;
}
