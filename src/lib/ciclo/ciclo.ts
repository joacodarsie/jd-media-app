/**
 * El ciclo quincenal de cada cuenta (acordado por el dueño con Luz, 17/10/2026).
 *
 * Todo se trabaja por quincenas con dos semanas de ventaja. Cada quincena que
 * se publica tiene su camino fijo: la community arma el calendario, lo aprueba
 * Santi, lo aprueba el cliente (si no contesta a tiempo, se da por aprobado),
 * el cliente manda el material, se produce, lo aprueban Santi y el cliente, y
 * se publica.
 *
 *   Se publica del 16 a fin de mes → calendario 1-2 · Santi 3-4 · cliente 5 ·
 *     material 7 · producción 5-13 · Santi 14 · cliente 15 · publica 16.
 *   Se publica del 1 al 15        → calendario 15-17 · Santi 19 · cliente 20 ·
 *     material 22 · producción 20-28 · Santi 29 · cliente 30 · publica 1.
 *   En febrero el 29 y el 30 son los dos últimos días del mes.
 *
 * El arranque corre con su propio reloj (regla de Luz): se publica desde el
 * día 15 del onboarding y el primer calendario cubre hasta el fin de esa
 * quincena. Si ese primer tramo queda de menos de 5 días, se estira a la
 * quincena siguiente. Después la cuenta entra en el ciclo fijo.
 *
 * Módulo PURO: fechas "YYYY-MM-DD" leídas por sus dígitos, sin zona horaria.
 */

export type Responsable = "cm" | "director" | "cliente" | "equipo";

export interface Hito {
  clave:
    | "calendario"
    | "aprueba_director_calendario"
    | "aprueba_cliente_calendario"
    | "material"
    | "produccion"
    | "aprueba_director_piezas"
    | "aprueba_cliente_piezas"
    | "publica";
  titulo: string;
  /** Desde cuándo se puede hacer (inclusive). */
  desde: string;
  /** Hasta cuándo (inclusive): la fecha límite. */
  hasta: string;
  responsable: Responsable;
}

export interface Quincena {
  /** Primer y último día que se publica. */
  inicio: string;
  fin: string;
  /** true si es el primer tramo, el del arranque. */
  arranque: boolean;
  hitos: Hito[];
}

// ── Fechas sin zona horaria ──────────────────────────────────────────────────

const t = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const sumar = (f: string, dias: number) => ymd(t(f) + dias * 86_400_000);
export const diasEntre = (a: string, b: string) => Math.round((t(b) - t(a)) / 86_400_000);
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes 1-12
const fecha = (anio: number, mes: number, dia: number) => {
  // Normaliza mes fuera de rango (0 → diciembre del año anterior, 13 → enero).
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${a}-${String(m).padStart(2, "0")}-${String(Math.min(dia, ultimoDia(a, m))).padStart(2, "0")}`;
};

/** La quincena (de publicación) que contiene a `f`. */
export function quincenaQueContiene(f: string): { inicio: string; fin: string } {
  const a = +f.slice(0, 4);
  const m = +f.slice(5, 7);
  const d = +f.slice(8, 10);
  if (d <= 15) return { inicio: fecha(a, m, 1), fin: fecha(a, m, 15) };
  return { inicio: fecha(a, m, 16), fin: fecha(a, m, ultimoDia(a, m)) };
}

/** La quincena que arranca justo después de `fin`. */
export const siguienteQuincena = (fin: string) => quincenaQueContiene(sumar(fin, 1));

/** Los hitos fijos de la quincena que se publica desde `inicio` (día 1 o 16). */
export function hitosRegulares(inicio: string): Hito[] {
  const a = +inicio.slice(0, 4);
  const m = +inicio.slice(5, 7);
  const h = (clave: Hito["clave"], titulo: string, desde: string, hasta: string, responsable: Responsable): Hito => ({ clave, titulo, desde, hasta, responsable });
  if (+inicio.slice(8, 10) === 16) {
    const d = (dia: number) => fecha(a, m, dia);
    return [
      h("calendario", "La community arma el calendario", d(1), d(2), "cm"),
      h("aprueba_director_calendario", "Santi aprueba el calendario", d(3), d(4), "director"),
      h("aprueba_cliente_calendario", "El cliente aprueba el calendario", d(5), d(5), "cliente"),
      h("material", "El cliente manda el material", d(5), d(7), "cliente"),
      h("produccion", "Diseño y edición producen", d(5), d(13), "equipo"),
      h("aprueba_director_piezas", "Santi aprueba las piezas", d(14), d(14), "director"),
      h("aprueba_cliente_piezas", "El cliente aprueba las piezas", d(15), d(15), "cliente"),
      h("publica", "Se publica", d(16), d(16), "equipo"),
    ];
  }
  // Se publica desde el 1: todo pasa en el mes anterior.
  const am = fecha(a, m - 1, 1);
  const pa = +am.slice(0, 4);
  const pm = +am.slice(5, 7);
  const fin = ultimoDia(pa, pm);
  const d = (dia: number) => fecha(pa, pm, dia);
  // En febrero, el 29 y el 30 son los dos últimos días del mes.
  const santi = fin < 30 ? fin - 1 : 29;
  const cliente = fin < 30 ? fin : 30;
  return [
    h("calendario", "La community arma el calendario", d(15), d(17), "cm"),
    h("aprueba_director_calendario", "Santi aprueba el calendario", d(18), d(19), "director"),
    h("aprueba_cliente_calendario", "El cliente aprueba el calendario", d(20), d(20), "cliente"),
    h("material", "El cliente manda el material", d(20), d(22), "cliente"),
    h("produccion", "Diseño y edición producen", d(20), d(Math.min(28, santi - 1)), "equipo"),
    h("aprueba_director_piezas", "Santi aprueba las piezas", d(santi), d(santi), "director"),
    h("aprueba_cliente_piezas", "El cliente aprueba las piezas", d(cliente), d(cliente), "cliente"),
    h("publica", "Se publica", inicio, inicio, "equipo"),
  ];
}

/** Los hitos del arranque, contados desde el día del onboarding. */
export function hitosArranque(onboarding: string, publica: string): Hito[] {
  const d = (n: number) => sumar(onboarding, n);
  const h = (clave: Hito["clave"], titulo: string, desde: string, hasta: string, responsable: Responsable): Hito => ({ clave, titulo, desde, hasta, responsable });
  return [
    h("calendario", "Primer calendario, biografía y kit de marca", d(0), d(3), "cm"),
    h("aprueba_director_calendario", "Santi aprueba", d(4), d(4), "director"),
    h("aprueba_cliente_calendario", "El cliente aprueba", d(5), d(5), "cliente"),
    h("material", "El cliente manda el material", d(5), d(7), "cliente"),
    h("produccion", "Diseño y edición producen", d(6), sumar(publica, -3), "equipo"),
    h("aprueba_director_piezas", "Santi aprueba las piezas", sumar(publica, -2), sumar(publica, -2), "director"),
    h("aprueba_cliente_piezas", "El cliente aprueba las piezas", sumar(publica, -1), sumar(publica, -1), "cliente"),
    h("publica", "Se publica", publica, publica, "equipo"),
  ];
}

/** El primer tramo de una cuenta: del día 15 del onboarding al fin de su quincena. */
export function quincenaDeArranque(onboarding: string): Quincena {
  const publica = sumar(onboarding, 15);
  let fin = quincenaQueContiene(publica).fin;
  // Un primer tramo de menos de 5 días no vale la pena: se estira a la siguiente.
  if (diasEntre(publica, fin) + 1 < 5) fin = siguienteQuincena(fin).fin;
  return { inicio: publica, fin, arranque: true, hitos: hitosArranque(onboarding, publica) };
}

/** Todas las quincenas de una cuenta desde el arranque hasta `hasta`. */
export function quincenasDesde(onboarding: string, hasta: string): Quincena[] {
  const out: Quincena[] = [quincenaDeArranque(onboarding)];
  while (out[out.length - 1].fin < hasta) {
    const q = siguienteQuincena(out[out.length - 1].fin);
    out.push({ ...q, arranque: false, hitos: hitosRegulares(q.inicio) });
  }
  return out;
}

export interface DondeEstamos {
  /** La quincena que se está publicando hoy (null si todavía no se publica nada). */
  publicando: Quincena | null;
  /** La quincena que se está preparando: es la que muestra la navecita. */
  preparando: Quincena;
  /** El hito en curso (o el próximo, si hoy no cae ninguno) de la que se prepara. */
  hito: Hito;
  /** Cuántos días faltan para la fecha límite de ese hito (0 = hoy). */
  faltan: number;
  /** 0..1: cuánto del camino de preparación ya se recorrió. */
  avance: number;
  /** Si hoy le toca algo al cliente, cuál. */
  alCliente: Hito | null;
  /** Otras quincenas que también se están preparando (en el arranque se superponen). */
  tambien: { quincena: Quincena; hito: Hito }[];
}

/**
 * En qué fecha está una cuenta. Se prepara la quincena siguiente mientras se
 * publica la actual: la navecita sigue a la que se prepara.
 */
export function dondeEstamos(onboarding: string, hoy: string): DondeEstamos {
  const quincenas = quincenasDesde(onboarding, sumar(hoy, 45));
  const publicando = quincenas.find((q) => q.inicio <= hoy && hoy <= q.fin) ?? null;
  // La que se prepara: la primera cuya publicación todavía no empezó y cuyo camino ya arrancó
  // (o la próxima a arrancar).
  const futuras = quincenas.filter((q) => q.inicio > hoy);
  const preparando = futuras.find((q) => q.hitos[0].desde <= hoy) ?? futuras[0];
  const hitos = preparando.hitos;
  const hito = hitos.find((h) => hoy <= h.hasta && h.clave !== "material") ?? hitos[hitos.length - 1];
  const inicioCamino = hitos[0].desde;
  const largo = Math.max(1, diasEntre(inicioCamino, preparando.inicio));
  const avance = Math.min(1, Math.max(0, diasEntre(inicioCamino, hoy) / largo));
  // Puede haber dos quincenas en preparación a la vez (en el arranque, por ejemplo):
  // lo que le toca al cliente se busca en todas.
  const alCliente =
    futuras.flatMap((q) => q.hitos).find((h) => h.responsable === "cliente" && h.desde <= hoy && hoy <= h.hasta) ?? null;
  const tambien = futuras
    .filter((q) => q !== preparando && q.hitos[0].desde <= hoy)
    .map((q) => ({ quincena: q, hito: q.hitos.find((h) => hoy <= h.hasta && h.clave !== "material") ?? q.hitos[q.hitos.length - 1] }));
  return { publicando, preparando, hito, faltan: Math.max(0, diasEntre(hoy, hito.hasta)), avance, alCliente, tambien };
}
