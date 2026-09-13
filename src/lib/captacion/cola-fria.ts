/**
 * La cola de contactos fríos de UNA persona, cruzando todas las campañas.
 *
 * Por qué existe: al 13/9/2026 había 1.090 contactos cargados, 470 de ellos con
 * un celular usable y nunca contactados, repartidos en 8 campañas. Para
 * trabajarlos había que entrar campaña por campaña y acordarse de cuál se dejó
 * por la mitad. El comercial no tenía UNA lista: tenía ocho. Y ninguna era suya
 * —947 de los 1.090 no tenían dueño—, así que no era de nadie.
 *
 * Este módulo arma esa lista: los contactos de una persona, ordenados por
 * probabilidad de que el mensaje llegue, con el freno del día puesto por su
 * meta. Todo puro: entra data cruda, sale la cola. Sin base ni red.
 */

import { esProbableFijoAr, SEGUIMIENTO_DIAS } from "@/lib/prospecting/shared";

export interface ContactoFrio {
  id: string;
  campaign_id: string;
  empresa: string;
  contacto_nombre: string | null;
  contacto_rol: string | null;
  telefono: string | null;
  instagram: string | null;
  sitio_web: string | null;
  estado: string;
  asignado_a: string | null;
  contactado_at: string | null;
  /** null = sin intentar · true = el dato sirve · false = no se pudo contactar. */
  contactable: boolean | null;
}

/**
 * ¿Se le puede mandar un WhatsApp a este número?
 *
 * Un fijo pasado a wa.me abre un chat muerto: el mensaje se da por mandado y
 * nunca lo lee nadie. Por eso el fijo no descalifica al contacto (puede tener
 * Instagram o mail), pero sí lo manda al fondo de la cola.
 */
export function tieneWhatsapp(telefono: string | null | undefined): boolean {
  if (!telefono) return false;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "54" + d.slice(1);
  // Números de afuera (España, etc.): no sabemos leerlos, pero un +34 marcado
  // como teléfono es tan contactable como cualquier otro.
  if (!d.startsWith("54")) return d.length >= 8;
  return !esProbableFijoAr(telefono);
}

/**
 * Cuánto conviene atacar este contacto primero. Más alto, más arriba.
 *
 * El orden no es capricho: cada punto es una vía real de llegada. Un contacto
 * con celular y nombre de la persona se responde mucho más que una razón social
 * con un conmutador, y el mensaje de la campaña ya viene escrito para saludar
 * por el nombre.
 */
export function puntajeContacto(c: ContactoFrio): number {
  let p = 0;
  if (tieneWhatsapp(c.telefono)) p += 100;
  else if (c.telefono) p += 10; // fijo: se puede llamar, no whatsappear
  if (c.contacto_nombre?.trim()) p += 20;
  if (c.instagram?.trim()) p += 8;
  if (c.sitio_web?.trim()) p += 4;
  return p;
}

/** Los que todavía no se tocaron y se pueden tocar. */
export function pendientes(contactos: ContactoFrio[]): ContactoFrio[] {
  return contactos.filter((c) => c.estado === "nuevo" && c.contactable !== false);
}

/** Días enteros entre un ISO y hoy ("YYYY-MM-DD"). null si falta el dato. */
export function diasDesdeIso(iso: string | null, hoy: string): number | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const a = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const b = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export interface ColaDelDia {
  /** Lo que hay para escribir hoy, ya ordenado. */
  cola: ContactoFrio[];
  /** Contactados hace SEGUIMIENTO_DIAS o más sin respuesta: hay que insistir. */
  seguimientos: ContactoFrio[];
  /** Cuántos escribió hoy. */
  hechosHoy: number;
  /** Cuántos le faltan para la meta del día (0 si ya la cumplió). */
  faltanHoy: number;
  /** Total de pendientes suyos, más allá de la meta de hoy. */
  pendientesTotal: number;
  /** De esos pendientes, a cuántos se les puede mandar un WhatsApp. */
  conWhatsapp: number;
  meta: number;
}

/**
 * La cola de hoy de una persona.
 *
 * `meta` es el freno: la cola no se corta ahí (si tiene ganas de seguir, que
 * siga), pero `faltanHoy` es el número que se le muestra y contra el que se lo
 * mide. Sin un número chico y alcanzable la lista de 470 paraliza.
 */
export function colaDelDia(input: {
  contactos: ContactoFrio[];
  userId: string;
  meta: number;
  hoy: string;
}): ColaDelDia {
  const { contactos, userId, meta, hoy } = input;
  const mios = contactos.filter((c) => c.asignado_a === userId);

  const libres = pendientes(mios);
  const cola = [...libres].sort(
    (a, b) => puntajeContacto(b) - puntajeContacto(a) || a.empresa.localeCompare(b.empresa)
  );

  const hechosHoy = mios.filter(
    (c) => c.contactado_at && c.contactado_at.slice(0, 10) === hoy
  ).length;

  const seguimientos = mios
    .filter((c) => c.estado === "contactado")
    .map((c) => ({ c, dias: diasDesdeIso(c.contactado_at, hoy) }))
    .filter((x) => x.dias != null && x.dias >= SEGUIMIENTO_DIAS)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
    .map((x) => x.c);

  return {
    cola,
    seguimientos,
    hechosHoy,
    faltanHoy: Math.max(0, meta - hechosHoy),
    pendientesTotal: libres.length,
    conWhatsapp: libres.filter((c) => tieneWhatsapp(c.telefono)).length,
    meta,
  };
}

/**
 * Cuántos días de trabajo quedan en la cola al ritmo de la meta. Sirve para
 * avisar antes de que se vacíe, no el día que ya no hay nada que hacer.
 */
export function diasDeCola(pendientesTotal: number, meta: number): number | null {
  if (meta <= 0) return null;
  return Math.floor(pendientesTotal / meta);
}
