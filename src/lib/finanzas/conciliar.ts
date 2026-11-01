/**
 * Conciliación automática con la planilla del dueño (1/11/2026).
 *
 * La planilla "Finanzas de Joaquín" carga sola cada movimiento del banco (por
 * las notificaciones del celular y el reporte de Mercado Pago). Cuando uno es
 * un cobro de un cliente o un sueldo del equipo, la app lo marca sola —cobrado
 * o pagado— y después le pregunta al dueño si estuvo bien. Antes había que
 * marcarlo a mano en "La plata del mes" y nadie lo hacía: septiembre quedó con
 * los sueldos sin marcar y la app creía que el equipo había costado $1,7 M en
 * vez de $2,98 M.
 *
 * Acá vive la parte que decide (puro y testeado). La que toca la base está en
 * conciliar-run.ts.
 */

export type TipoMovimiento = "cobro" | "sueldo";

export interface MovimientoPlanilla {
  /** Clave estable del movimiento en la planilla: no se procesa dos veces. */
  clave: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** Siempre positivo, en pesos. */
  monto: number;
  /** "JD · Cobro de cliente" o "JD · Pagos al equipo". */
  categoria: string;
  /** "Cliente / detalle" de la planilla: el nombre del cliente o de la persona. */
  detalle: string;
  descripcion?: string | null;
  cuenta?: string | null;
}

/** "Résonar  Studio" → "resonar studio": sin tildes, minúsculas, un espacio. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tipoDe(categoria: string): TipoMovimiento | null {
  const c = normalizar(categoria);
  if (c.includes("cobro de cliente")) return "cobro";
  if (c.includes("pagos al equipo")) return "sueldo";
  return null;
}

/**
 * Las jornadas de producción se cobran aparte y tienen su propio registro: no
 * son el abono. Si se aplicaran al abono, una jornada de $50.000 quedaría como
 * "pagó una parte del mes".
 */
export function esJornada(m: Pick<MovimientoPlanilla, "detalle" | "descripcion">): boolean {
  return /jornada/.test(normalizar(`${m.detalle} ${m.descripcion ?? ""}`));
}

/** "YYYY-MM" del mes de una fecha "YYYY-MM-DD". */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function mesAnterior(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * A qué mes corresponde un sueldo pagado en `fecha`. El equipo cobra el 7 del
 * mes siguiente, así que lo que se transfiere en la primera parte del mes es
 * el sueldo del mes anterior. Desde el 21 se toma como un adelanto del mes.
 */
export function periodoDeSueldo(fecha: string): string {
  const dia = Number(fecha.slice(8, 10));
  return dia <= 20 ? mesAnterior(mesDe(fecha)) : mesDe(fecha);
}

// ─────────────────────────────── a quién ───────────────────────────────

export interface Nombrado {
  id: string;
  nombre: string;
}

/**
 * Los clientes que nombra el detalle. Pueden ser varios: Américo paga
 * "Boxescar + La Azotea" en una sola transferencia.
 */
export function clientesDelDetalle<T extends Nombrado>(detalle: string, clientes: T[]): T[] {
  const d = ` ${normalizar(detalle)} `;
  const encontrados = clientes.filter((c) => {
    const n = normalizar(c.nombre);
    return n.length >= 3 && d.includes(` ${n} `);
  });
  // Si un nombre está contenido en otro ("Magic" y "Magic Store"), gana el largo.
  return encontrados.filter(
    (c) =>
      !encontrados.some(
        (o) => o !== c && normalizar(o.nombre).includes(normalizar(c.nombre)) && o.nombre.length > c.nombre.length,
      ),
  );
}

/**
 * La persona del equipo que nombra el detalle. Alcanza con el apellido
 * ("Santi Reinaldi" → Santiago Reinaldi); si dos comparten apellido, gana la
 * que coincide en más palabras, y si empatan no se elige a nadie.
 */
export function personaDelDetalle<T extends Nombrado>(detalle: string, personas: T[]): T | null {
  const palabras = new Set(normalizar(detalle).split(" ").filter((w) => w.length >= 3));
  const puntaje = (p: T) => {
    const ws = normalizar(p.nombre).split(" ").filter((w) => w.length >= 3);
    const apellido = ws[ws.length - 1];
    if (!apellido || !palabras.has(apellido)) return 0;
    return ws.filter((w) => palabras.has(w)).length;
  };
  const conPuntaje = personas.map((p) => ({ p, s: puntaje(p) })).filter((x) => x.s > 0);
  if (!conPuntaje.length) return null;
  conPuntaje.sort((a, b) => b.s - a.s);
  if (conPuntaje.length > 1 && conPuntaje[0].s === conPuntaje[1].s) return null;
  return conPuntaje[0].p;
}

// ─────────────────────────────── cobros ───────────────────────────────

/** Lo que debe un cliente de un mes: todas sus facturas impagas, menos lo entregado a cuenta. */
export interface DeudaMes {
  clienteId: string;
  cliente: string;
  periodo: string;
  saldo: number;
  /** true si todavía no hay factura de ese mes (se crea al cobrar, con el abono). */
  sinFactura?: boolean;
}

export type AccionCobro =
  | { tipo: "cobrado"; clienteId: string; cliente: string; periodo: string; monto: number; sinFactura?: boolean }
  | { tipo: "parcial"; clienteId: string; cliente: string; periodo: string; monto: number; sinFactura?: boolean };

/** Diferencias de redondeo o de comisión: menos de esto, el mes se da por pagado. */
const TOLERANCIA = 0.02;

/**
 * Reparte un cobro entre lo que debe el cliente, de lo más viejo a lo más
 * nuevo. Si alcanza para un mes (con una tolerancia del 2%), el mes queda
 * cobrado; si no, lo que entró queda como entrega a cuenta. Un cliente que
 * paga dos meses juntos salda los dos.
 */
export function planificarCobro(
  deudas: DeudaMes[],
  monto: number,
): { acciones: AccionCobro[]; sobrante: number } {
  const acciones: AccionCobro[] = [];
  let resto = Math.round(monto);
  const orden = [...deudas].filter((d) => d.saldo > 0).sort((a, b) => a.periodo.localeCompare(b.periodo));
  for (const d of orden) {
    if (resto <= 0) break;
    const base = { clienteId: d.clienteId, cliente: d.cliente, periodo: d.periodo, ...(d.sinFactura ? { sinFactura: true } : {}) };
    if (resto >= d.saldo * (1 - TOLERANCIA)) {
      acciones.push({ tipo: "cobrado", ...base, monto: Math.min(resto, d.saldo) });
      resto -= Math.min(resto, d.saldo);
    } else {
      acciones.push({ tipo: "parcial", ...base, monto: resto });
      resto = 0;
    }
  }
  return { acciones, sobrante: Math.max(0, Math.round(resto)) };
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function nombreMes(periodo: string): string {
  return MESES[Number(periodo.slice(5, 7)) - 1] ?? periodo;
}

/** Lo que se le cuenta al dueño (y lo que vuelve a la columna de la planilla). */
export function mensajeCobro(acciones: AccionCobro[], sobrante: number): string {
  const partes = acciones.map((a) =>
    a.tipo === "cobrado"
      ? `${a.cliente} ${nombreMes(a.periodo)} cobrado`
      : `${a.cliente} ${nombreMes(a.periodo)}: entrega de ${pesos(a.monto)}`,
  );
  if (sobrante > 0) partes.push(`sobran ${pesos(sobrante)} sin aplicar`);
  return partes.join(" · ");
}
