/**
 * Los equipos de trabajo (24/10/2026, pedido del dueño). Hoy la agencia se
 * maneja por equipos —cada uno con su grupo de WhatsApp—, y la plataforma los
 * tenía cargados pero no los usaba. Este módulo responde:
 *
 *  - ¿Cuántas cuentas entran? Cada equipo tiene un tope (8 por defecto). Con
 *    eso se ve si llegamos a la meta de 50 sin armar más equipos.
 *  - ¿A qué equipo va la próxima cuenta? Al que tiene más lugar.
 *  - ¿Quién se satura primero? Una persona puede estar en varios equipos: si
 *    todos llegan al tope, cuántas cuentas lleva cada una.
 *  - ¿Qué cuenta tiene gente distinta a la de su equipo?
 *
 * Módulo PURO.
 */

export interface EquipoBase {
  id: string;
  nombre: string;
  tope: number;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  extra_ids: string[];
}

export interface CuentaDeEquipo {
  id: string;
  nombre: string;
  team_id: string | null;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
}

export const ROLES = [
  { campo: "cm_id", label: "CM" },
  { campo: "disenador_id", label: "Diseño" },
  { campo: "audiovisual_id", label: "Edición" },
  { campo: "media_buyer_id", label: "Pauta" },
] as const;

export function miembrosDe(e: EquipoBase): string[] {
  return Array.from(new Set([e.cm_id, e.disenador_id, e.audiovisual_id, e.media_buyer_id, ...(e.extra_ids ?? [])].filter((x): x is string => !!x)));
}

export interface Lugar {
  id: string;
  nombre: string;
  cuentas: number;
  tope: number;
  libres: number;
}

export function lugares(equipos: EquipoBase[], cuentas: CuentaDeEquipo[]): Lugar[] {
  return equipos.map((e) => {
    const n = cuentas.filter((c) => c.team_id === e.id).length;
    return { id: e.id, nombre: e.nombre, cuentas: n, tope: e.tope, libres: Math.max(0, e.tope - n) };
  });
}

/** El equipo con más lugar (a igualdad, el que tiene menos cuentas). null si están todos llenos. */
export function equipoSugerido(l: Lugar[]): Lugar | null {
  const conLugar = l.filter((x) => x.libres > 0);
  if (!conLugar.length) return null;
  return [...conLugar].sort((a, b) => b.libres - a.libres || a.cuentas - b.cuentas)[0];
}

export interface Capacidad {
  enEquipos: number;
  capacidad: number;
  /** Cuentas activas que no van en un equipo (las lleva una persona sola, o no son de redes). */
  fueraDeEquipo: number;
  /** Cuántas cuentas en total se pueden tener con los equipos llenos. */
  maximo: number;
  meta: number;
  /** Cuántas cuentas faltan para la meta con lo que hay hoy. */
  faltanParaMeta: number;
  /** Cuántos lugares faltan si los equipos se llenan (0 = alcanza). */
  lugaresQueFaltan: number;
  /** Equipos nuevos que harían falta con el tope por defecto. */
  equiposQueFaltan: number;
}

export function capacidad(l: Lugar[], totalActivas: number, meta: number, topeDefecto = 8): Capacidad {
  const enEquipos = l.reduce((s, x) => s + x.cuentas, 0);
  const cap = l.reduce((s, x) => s + x.tope, 0);
  const fuera = Math.max(0, totalActivas - enEquipos);
  const maximo = cap + fuera;
  const faltan = Math.max(0, meta - maximo);
  return {
    enEquipos,
    capacidad: cap,
    fueraDeEquipo: fuera,
    maximo,
    meta,
    faltanParaMeta: Math.max(0, meta - totalActivas),
    lugaresQueFaltan: faltan,
    equiposQueFaltan: Math.ceil(faltan / topeDefecto),
  };
}

export interface CargaPersona {
  userId: string;
  equipos: string[];
  /** Cuentas que lleva hoy por estar en esos equipos. */
  hoy: number;
  /** Las que llevaría si todos sus equipos llegan al tope. */
  conEquiposLlenos: number;
}

/** Quién se satura primero si los equipos se llenan: la gente que está en varios. */
export function cargaPorPersona(equipos: EquipoBase[], l: Lugar[]): CargaPersona[] {
  const porId = new Map(l.map((x) => [x.id, x]));
  const out = new Map<string, CargaPersona>();
  for (const e of equipos) {
    const lug = porId.get(e.id);
    for (const u of miembrosDe(e)) {
      const c = out.get(u) ?? { userId: u, equipos: [], hoy: 0, conEquiposLlenos: 0 };
      c.equipos.push(e.nombre);
      c.hoy += lug?.cuentas ?? 0;
      c.conEquiposLlenos += e.tope;
      out.set(u, c);
    }
  }
  return [...out.values()].sort((a, b) => b.conEquiposLlenos - a.conEquiposLlenos || b.hoy - a.hoy);
}

/**
 * Lo que la cuenta tiene distinto de su equipo: un rol con alguien que no es
 * del equipo, o sin nadie cuando el equipo tiene a alguien para ese rol.
 */
export function diferencias(c: CuentaDeEquipo, e: EquipoBase, nombre: (id: string) => string): string[] {
  const miembros = new Set(miembrosDe(e));
  const out: string[] = [];
  for (const r of ROLES) {
    const quien = c[r.campo];
    const delEquipo = e[r.campo];
    if (quien && !miembros.has(quien)) out.push(`${r.label}: ${nombre(quien)} no es del equipo${delEquipo ? ` (el equipo tiene a ${nombre(delEquipo)})` : ""}`);
    else if (!quien && delEquipo) out.push(`${r.label}: sin asignar (el equipo tiene a ${nombre(delEquipo)})`);
  }
  return out;
}

/** Los equipos de una persona (los que integra). */
export function equiposDePersona(userId: string, equipos: EquipoBase[]): EquipoBase[] {
  return equipos.filter((e) => miembrosDe(e).includes(userId));
}

/** Lo que el formulario de la cuenta necesita para elegir el equipo. */
export interface EquipoOpcion {
  id: string;
  nombre: string;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  cuentas: number;
  tope: number;
}

export function opcionesDeEquipo(equipos: EquipoBase[], cuentas: CuentaDeEquipo[]): EquipoOpcion[] {
  const l = new Map(lugares(equipos, cuentas).map((x) => [x.id, x]));
  return equipos.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    cm_id: e.cm_id,
    disenador_id: e.disenador_id,
    audiovisual_id: e.audiovisual_id,
    media_buyer_id: e.media_buyer_id,
    cuentas: l.get(e.id)?.cuentas ?? 0,
    tope: e.tope,
  }));
}
