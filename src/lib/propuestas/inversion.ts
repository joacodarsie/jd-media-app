/**
 * Los números de la propuesta: una o varias cuentas, el descuento por llevarlas
 * juntas, el proporcional del primer mes y qué se entrega ese mes.
 *
 * Sale de armar a mano las propuestas de RIP Cerro y de Catch. Lo que se
 * aprendió ahí y acá queda fijo:
 *
 *  - Un prospecto puede tener MÁS DE UNA cuenta (Catch: @barcatch en Crecimiento
 *    y @fyna.club en Presencia). Hay que mostrar el precio de cada una y el
 *    total con el descuento, no un pack suelto.
 *  - El primer mes NO entrega el pack completo: la primera semana es de armado
 *    y no se publica, así que sale el equivalente a 3 de 4 semanas. Decirlo
 *    antes evita el reclamo del día 30 (regla de /coordinacion/mes-uno).
 *  - Si entra un día distinto al 1º se cobra proporcional a los días que
 *    quedan, porque el abono siempre se paga el 1º.
 *
 * Puro y testeado: son los números que decide un cierre.
 */

import type { PackCatalogo } from "./build";

export interface CuentaPropuesta {
  /** "@barcatch" o "Instagram principal": lo que se muestra como título. */
  handle: string;
  /** Slug del pack del catálogo. */
  packSlug: string;
  /** Para qué es esa cuenta. Una línea, opcional. */
  nota?: string | null;
}

export interface LineaInversion {
  handle: string;
  packNombre: string;
  /** "8 reels · 8 carruseles · 12 días de historias" */
  volumen: string | null;
  precio: number | null;
  nota: string | null;
  pack: PackCatalogo;
}

export interface Inversion {
  lineas: LineaInversion[];
  subtotal: number;
  descuento: number;
  total: number;
  /** Solo se muestra el bloque de descuento si hay más de una cuenta y un monto. */
  hayDescuento: boolean;
  /** true si alguna cuenta quedó sin precio (pack Personalizado). */
  aMedida: boolean;
}

/** El volumen de un pack en una línea. Null para "Personalizado". */
export function volumenDePack(p: PackCatalogo): string | null {
  const partes: string[] = [];
  if (p.reels) partes.push(`${p.reels} reels`);
  if (p.posts) partes.push(`${p.posts} carruseles`);
  if (p.dias_historias) partes.push(`${p.dias_historias} días de historias`);
  return partes.length ? partes.join(" · ") : null;
}

/**
 * Arma el cuadro de inversión. El descuento se ignora si hay una sola cuenta:
 * el "descuento por llevar las dos" no existe cuando hay una.
 */
export function armarInversion(
  cuentas: CuentaPropuesta[],
  packs: PackCatalogo[],
  descuento: number
): Inversion {
  const porSlug = new Map(packs.map((p) => [p.slug, p]));

  const lineas: LineaInversion[] = [];
  for (const c of cuentas) {
    const pack = porSlug.get(c.packSlug);
    if (!pack) continue;
    lineas.push({
      handle: handleBonito(c.handle),
      packNombre: pack.nombre,
      volumen: volumenDePack(pack),
      precio: pack.precio_mensual,
      nota: c.nota?.trim() || null,
      pack,
    });
  }

  const subtotal = lineas.reduce((a, l) => a + (l.precio ?? 0), 0);
  const hayDescuento = lineas.length > 1 && descuento > 0 && subtotal > 0;
  const desc = hayDescuento ? Math.min(descuento, subtotal) : 0;

  return {
    lineas,
    subtotal,
    descuento: desc,
    total: subtotal - desc,
    hayDescuento,
    aMedida: lineas.some((l) => l.precio == null),
  };
}

/** Días que tiene el mes de una fecha "YYYY-MM-DD". */
export function diasDelMes(fecha: string): number {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export interface Proporcional {
  /** Días que se cobran, del día de arranque al último del mes, inclusive. */
  dias: number;
  diasDelMes: number;
  monto: number;
  /** "septiembre" */
  mes: string;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * El proporcional del primer mes. Null si arranca el 1º (no hay proporcional)
 * o si no hay fecha ni total.
 */
export function proporcionalPrimerMes(total: number, desde: string | null | undefined): Proporcional | null {
  if (!total || !desde || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
  const dia = Number(desde.slice(8, 10));
  const mes = Number(desde.slice(5, 7));
  if (!dia || dia === 1) return null;
  const total_dias = diasDelMes(desde);
  const dias = total_dias - dia + 1;
  if (dias <= 0) return null;
  return {
    dias,
    diasDelMes: total_dias,
    monto: Math.round((total * dias) / total_dias),
    mes: MESES[mes - 1] ?? "",
  };
}

export interface VolumenMes1 {
  handle: string;
  texto: string;
}

/**
 * Lo que se publica el PRIMER mes: tres cuartos del pack, porque la primera
 * semana se usa para armar las bases y no sale contenido.
 *
 * Se redondea para abajo para no prometer de más, pero nunca por debajo de 1
 * cuando el pack tiene ese formato: entregar cero reels sonaría a error.
 */
export function volumenPrimerMes(lineas: LineaInversion[]): VolumenMes1[] {
  const tresCuartos = (n: number | null): number => {
    if (!n) return 0;
    return Math.max(1, Math.floor((n * 3) / 4));
  };
  return lineas
    .map((l) => {
      const partes: string[] = [];
      const r = tresCuartos(l.pack.reels);
      const c = tresCuartos(l.pack.posts);
      const h = tresCuartos(l.pack.dias_historias);
      if (r) partes.push(`${r} reels`);
      if (c) partes.push(`${c} carruseles`);
      if (h) partes.push(`${h} días de historias`);
      return { handle: l.handle, texto: partes.join(", ") };
    })
    .filter((x) => x.texto);
}

/**
 * La aclaración de las jornadas de producción.
 *
 * Por qué depende de la ciudad: el texto del catálogo dice "más traslado si es
 * fuera de la ciudad". A un prospecto de Córdoba esa frase le mete una duda de
 * costo que no le corresponde —no le van a cobrar traslado—, y a uno del
 * interior se la esconde entre paréntesis. Se dice lo que aplica a cada uno.
 */
export function textoJornadas(ciudad: string | null | undefined, base = 50000, adicional = 25000): string {
  const p = (n: number) => `$${n.toLocaleString("es-AR")}`;
  if (esDeCordoba(ciudad)) {
    return `Sesión de producción en locación: ${p(base)} la hora y ${p(adicional)} cada hora adicional, sin cargo de traslado.`;
  }
  return `Sesión de producción en locación: ${p(base)} la hora y ${p(adicional)} cada hora adicional, más el traslado del equipo.`;
}

/** ¿El prospecto está en Córdoba capital o alrededores? */
export function esDeCordoba(ciudad: string | null | undefined): boolean {
  const c = (ciudad ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (!c) return false;
  return /\bcordoba\b|\bcba\b|villa allende|unquillo|rio ceballos|saldan|la calera|malagueno|mendiolaza|carlos paz/.test(c);
}

/**
 * El nombre de la cuenta como se muestra en el documento.
 *
 * En la ficha del prospecto el Instagram se guarda como URL completa, y
 * "https://www.instagram.com/barcatch/" arriba de un precio queda feo y ocupa
 * dos líneas. Se muestra "@barcatch".
 */
export function handleBonito(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return t;
  const m = t.match(/(?:instagram|tiktok)\.com\/+([^/?#\s]+)/i);
  if (m) return `@${m[1].replace(/^@/, "")}`;
  return t;
}
