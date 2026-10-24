/**
 * Los casos de éxito en la propuesta (24/10/2026, pedido del dueño): la
 * propuesta prometía y no mostraba. Ahora lleva una hoja «Resultados reales»
 * con las cuentas que más crecieron (las mismas del antes y después de la
 * web), y primero la del rubro del prospecto: a una cabaña le habla La Azotea,
 * a un consultorio el Dr. Dionisi.
 *
 * Módulo PURO.
 */
import type { CasoWeb } from "@/lib/web/vitrina";

export interface CasoConRubro extends CasoWeb {
  rubro: string | null;
}

/** Palabras del rubro escrito a mano en la ficha del cliente → el rubro de la propuesta. */
const PISTAS: [string, RegExp][] = [
  ["hoteleria", /turism|caba[ñn]|hotel|hosped|suite|aloja/],
  ["gastronomia", /gastro|cocina|resto|comida|caf[eé]|panad|medialuna|snack|frutos/],
  ["salud", /salud|m[eé]dic|odont|cl[ií]nic|consultor|dr\b|kinesi|nutri/],
  ["arquitectura", /arquitect|interior|dise[ñn]o de/],
  ["construccion", /constru|desarroll|inmobil/],
  ["educacion", /educa|escuela|curso|capacita|instituto/],
  ["fitness", /gimnas|fitness|entrena|crossfit|pilates/],
  ["legal", /jur[ií]dic|abogad|contad|estudio/],
  ["automotor", /auto|veh[ií]cul|concesion|taller|satelital/],
  ["indumentaria", /indumentaria|ropa|moda|calzado|retail/],
  ["eventos", /event|fiesta|ambientac|decorac|infantil|sal[oó]n/],
  ["belleza", /est[eé]tic|cosm[eé]t|belleza|peluquer|spa|u[ñn]as/],
  ["servicios_hogar", /hogar|mueble|sill[oó]n|limpieza|plomer/],
  ["ecommerce", /tienda online|e-?commerce|venta online/],
  ["ong", /fundaci|\bong\b|asociaci|autismo/],
];

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function rubroDeCliente(texto: string | null | undefined): string | null {
  const t = sinTildes(texto ?? "");
  if (!t) return null;
  // Las pistas se escriben con tilde por legibilidad: se comparan sin tildes.
  return PISTAS.find(([, re]) => new RegExp(sinTildes(re.source)).test(t))?.[0] ?? null;
}

/**
 * Hasta `max` casos: primero los del rubro del prospecto, después los más
 * fuertes (vienen ordenados por cuánto mejoraron).
 */
export function casosParaPropuesta(casos: CasoConRubro[], rubroSlug: string | null | undefined, max = 2): (CasoConRubro & { mismoRubro: boolean })[] {
  const marcados = casos.map((c) => ({ ...c, mismoRubro: !!rubroSlug && rubroDeCliente(c.rubro) === rubroSlug }));
  return [...marcados.filter((c) => c.mismoRubro), ...marcados.filter((c) => !c.mismoRubro)].slice(0, max);
}
