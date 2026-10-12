/**
 * Efemérides de Argentina para tener en cuenta en los calendarios.
 *
 * Pedido del dueño (12/10/2026): "hay efemérides muy importantes y a veces se
 * olvidan". Hasta ahora solo las pensaba la IA al armar cada plan mensual, cuenta
 * por cuenta. Esto es la agenda fija: se avisa 30 días antes en Mi día y se
 * marca en el calendario de Contenidos. Después cada CM decide si a su cuenta
 * le sirve.
 *
 * Dos niveles:
 * - `todas`: afectan a todas las cuentas (Navidad, Día de la Madre…).
 * - `rubro`: sirven a algunas. Llevan palabras clave para sugerir las cuentas
 *   cuyo rubro coincide.
 *
 * Solo fechas seguras. Las que cambian cada año y anuncia un tercero (Hot Sale,
 * Cyber Monday) van con `aprox`: se avisa el mes, la fecha exacta se confirma.
 *
 * Puro: entra un año, sale la lista con sus fechas.
 */

export type Alcance = "todas" | "rubro";
export type TipoEfemeride = "celebracion" | "comercial" | "patria" | "profesion" | "causa";

export interface Efemeride {
  /** "YYYY-MM-DD" */
  fecha: string;
  nombre: string;
  alcance: Alcance;
  tipo: TipoEfemeride;
  /** Para sugerir cuentas: se buscan en el rubro del cliente (sin tildes, minúsculas). */
  claves?: string[];
  /** La fecha exacta se confirma cada año (la anuncia un tercero). */
  aprox?: boolean;
  /** Una línea de contexto: cómo encararla. */
  nota?: string;
}

type Regla =
  | { dia: number; mes: number }
  | { nesimo: number; diaSemana: number; mes: number } // diaSemana: 0 domingo
  | { pascua: number }; // días desde el domingo de Pascua

interface Def extends Omit<Efemeride, "fecha"> {
  regla: Regla;
}

const VENTA_ONLINE = ["tienda", "venta", "cosmet", "snack", "fruto", "mueble", "sillon", "ropa", "indumentaria", "juego", "regalo", "accesorio"];
const SALUD = ["salud", "medic", "clinic", "consultorio", "odonto", "kinesio", "psico"];

const DEFS: Def[] = [
  // ---- Todas las cuentas ----
  { regla: { dia: 1, mes: 1 }, nombre: "Año Nuevo", alcance: "todas", tipo: "celebracion" },
  { regla: { pascua: -48 }, nombre: "Carnaval", alcance: "todas", tipo: "celebracion", nota: "Fin de semana largo: menos actividad, buen momento para contenido liviano." },
  { regla: { dia: 8, mes: 3 }, nombre: "Día Internacional de la Mujer", alcance: "todas", tipo: "causa", nota: "Tono de reconocimiento, no de promo." },
  { regla: { dia: 24, mes: 3 }, nombre: "Día de la Memoria (feriado)", alcance: "todas", tipo: "patria", nota: "Tono respetuoso; mejor no publicar promos." },
  { regla: { dia: 2, mes: 4 }, nombre: "Día de los Veteranos y Caídos en Malvinas (feriado)", alcance: "todas", tipo: "patria", nota: "Tono respetuoso; mejor no publicar promos." },
  { regla: { pascua: 0 }, nombre: "Pascuas", alcance: "todas", tipo: "celebracion" },
  { regla: { dia: 1, mes: 5 }, nombre: "Día del Trabajador (feriado)", alcance: "todas", tipo: "celebracion" },
  { regla: { dia: 25, mes: 5 }, nombre: "Revolución de Mayo (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { nesimo: 3, diaSemana: 0, mes: 6 }, nombre: "Día del Padre", alcance: "todas", tipo: "celebracion", claves: VENTA_ONLINE },
  { regla: { dia: 20, mes: 6 }, nombre: "Día de la Bandera (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { dia: 9, mes: 7 }, nombre: "Día de la Independencia (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { dia: 20, mes: 7 }, nombre: "Día del Amigo", alcance: "todas", tipo: "celebracion", claves: ["evento", "fiesta", "turismo", "cabana", "gastro", "bar", "resto"] },
  { regla: { dia: 17, mes: 8 }, nombre: "Paso a la Inmortalidad de San Martín (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { nesimo: 3, diaSemana: 0, mes: 8 }, nombre: "Día de las Infancias", alcance: "todas", tipo: "celebracion", claves: ["infantil", "juego", "nino", "educa", "jugueteria"] },
  { regla: { dia: 21, mes: 9 }, nombre: "Día de la Primavera y del Estudiante", alcance: "todas", tipo: "celebracion", claves: ["educa", "curso", "estudiante", "evento", "fiesta", "turismo"] },
  { regla: { dia: 12, mes: 10 }, nombre: "Día del Respeto a la Diversidad Cultural (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { nesimo: 3, diaSemana: 0, mes: 10 }, nombre: "Día de la Madre", alcance: "todas", tipo: "celebracion", claves: VENTA_ONLINE, nota: "La más fuerte del año para regalos: arrancar la comunicación 2 semanas antes." },
  { regla: { dia: 20, mes: 11 }, nombre: "Día de la Soberanía Nacional (feriado)", alcance: "todas", tipo: "patria" },
  { regla: { dia: 8, mes: 12 }, nombre: "Inmaculada Concepción (feriado)", alcance: "todas", tipo: "celebracion" },
  { regla: { dia: 24, mes: 12 }, nombre: "Nochebuena", alcance: "todas", tipo: "celebracion" },
  { regla: { dia: 25, mes: 12 }, nombre: "Navidad", alcance: "todas", tipo: "celebracion", nota: "Saludo de todas las cuentas; dejarlo programado antes." },
  { regla: { dia: 31, mes: 12 }, nombre: "Fin de año", alcance: "todas", tipo: "celebracion", nota: "Cierre del año y balance: buen contenido para la marca." },

  // ---- Comerciales ----
  { regla: { dia: 14, mes: 2 }, nombre: "San Valentín", alcance: "rubro", tipo: "comercial", claves: [...VENTA_ONLINE, "turismo", "cabana", "gastro", "resto"] },
  { regla: { nesimo: 2, diaSemana: 1, mes: 5 }, nombre: "Hot Sale", alcance: "rubro", tipo: "comercial", claves: VENTA_ONLINE, aprox: true, nota: "La fecha exacta la anuncia la CACE: confirmarla." },
  { regla: { nesimo: 1, diaSemana: 1, mes: 11 }, nombre: "Cyber Monday", alcance: "rubro", tipo: "comercial", claves: VENTA_ONLINE, aprox: true, nota: "La fecha exacta la anuncia la CACE: confirmarla." },
  { regla: { nesimo: 4, diaSemana: 5, mes: 11 }, nombre: "Black Friday", alcance: "rubro", tipo: "comercial", claves: VENTA_ONLINE },

  // ---- Profesiones y rubros ----
  { regla: { dia: 24, mes: 2 }, nombre: "Día del Mecánico", alcance: "rubro", tipo: "profesion", claves: ["automot", "lubricentro", "mecanic", "taller"] },
  { regla: { dia: 2, mes: 4 }, nombre: "Día Mundial de Concientización sobre el Autismo", alcance: "rubro", tipo: "causa", claves: ["autismo", ...SALUD] },
  { regla: { dia: 7, mes: 4 }, nombre: "Día Mundial de la Salud", alcance: "rubro", tipo: "causa", claves: SALUD },
  { regla: { dia: 13, mes: 4 }, nombre: "Día del Kinesiólogo", alcance: "rubro", tipo: "profesion", claves: ["kinesio", "salud"] },
  { regla: { dia: 29, mes: 4 }, nombre: "Día del Animal", alcance: "rubro", tipo: "causa", claves: ["mascota", "veterin", "animal", "pet"] },
  { regla: { dia: 5, mes: 6 }, nombre: "Día Mundial del Medio Ambiente", alcance: "rubro", tipo: "causa", claves: ["natural", "eco", "organic", "sustentab", "construc"] },
  { regla: { dia: 7, mes: 6 }, nombre: "Día del Periodista", alcance: "rubro", tipo: "profesion", claves: ["medio", "comunica", "prensa"] },
  { regla: { dia: 11, mes: 9 }, nombre: "Día del Maestro", alcance: "rubro", tipo: "profesion", claves: ["educa", "curso", "escuela", "colegio", "instituto"] },
  { regla: { dia: 26, mes: 9 }, nombre: "Día del Empleado de Comercio", alcance: "rubro", tipo: "profesion", claves: ["comercio", "tienda", "local"] },
  { regla: { dia: 27, mes: 9 }, nombre: "Día Mundial del Turismo", alcance: "rubro", tipo: "causa", claves: ["turismo", "cabana", "hotel", "viaje", "suite"] },
  { regla: { dia: 3, mes: 10 }, nombre: "Día del Odontólogo", alcance: "rubro", tipo: "profesion", claves: ["odonto", "dental", "salud"] },
  { regla: { nesimo: 1, diaSemana: 1, mes: 10 }, nombre: "Día Mundial de la Arquitectura", alcance: "rubro", tipo: "profesion", claves: ["arquitect", "construc", "interior", "deco", "ambienta"] },
  { regla: { dia: 13, mes: 10 }, nombre: "Día del Psicólogo", alcance: "rubro", tipo: "profesion", claves: ["psico", "salud"] },
  { regla: { dia: 16, mes: 10 }, nombre: "Día Mundial de la Alimentación", alcance: "rubro", tipo: "causa", claves: ["aliment", "snack", "fruto", "gastro", "comida", "natural"] },
  { regla: { dia: 10, mes: 11 }, nombre: "Día de la Tradición", alcance: "rubro", tipo: "celebracion", claves: ["turismo", "gastro", "campo", "regional"] },
  { regla: { dia: 21, mes: 11 }, nombre: "Día de la Enfermería", alcance: "rubro", tipo: "profesion", claves: SALUD },
  { regla: { dia: 22, mes: 11 }, nombre: "Día de la Música", alcance: "rubro", tipo: "celebracion", claves: ["musica", "tecno", "dj", "evento", "fiesta"] },
  { regla: { dia: 3, mes: 12 }, nombre: "Día del Médico", alcance: "rubro", tipo: "profesion", claves: SALUD },
];

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function pascua(anio: number): { mes: number; dia: number } {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function fechaDe(regla: Regla, anio: number): string {
  if ("pascua" in regla) {
    const p = pascua(anio);
    return ymd(new Date(Date.UTC(anio, p.mes - 1, p.dia + regla.pascua)));
  }
  if ("dia" in regla) return ymd(new Date(Date.UTC(anio, regla.mes - 1, regla.dia)));
  // El n-ésimo día de la semana del mes.
  const primero = new Date(Date.UTC(anio, regla.mes - 1, 1)).getUTCDay();
  const dia = 1 + ((regla.diaSemana - primero + 7) % 7) + (regla.nesimo - 1) * 7;
  return ymd(new Date(Date.UTC(anio, regla.mes - 1, dia)));
}

/** Todas las efemérides de un año, ordenadas por fecha. */
export function efemeridesDelAnio(anio: number): Efemeride[] {
  return DEFS.map(({ regla, ...e }) => ({ ...e, fecha: fechaDe(regla, anio) })).sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.alcance === "todas" ? -1 : 1)
  );
}

/** Las que caen entre `desde` y `hasta` (inclusive), cruzando el año si hace falta. */
export function efemeridesEntre(desde: string, hasta: string): Efemeride[] {
  const a1 = Number(desde.slice(0, 4));
  const a2 = Number(hasta.slice(0, 4));
  const todas: Efemeride[] = [];
  for (let a = a1; a <= a2; a++) todas.push(...efemeridesDelAnio(a));
  return todas.filter((e) => e.fecha >= desde && e.fecha <= hasta);
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Las cuentas cuyo rubro coincide con alguna palabra clave de la efeméride. */
export function cuentasQueAplican<T extends { nombre: string; rubro: string | null }>(
  e: Efemeride,
  cuentas: T[]
): T[] {
  if (!e.claves?.length) return [];
  return cuentas.filter((c) => {
    const r = normalizar(c.rubro ?? "");
    return !!r && e.claves!.some((k) => r.includes(k));
  });
}

/** Días entre dos "YYYY-MM-DD". */
export function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}
