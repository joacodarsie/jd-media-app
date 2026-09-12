/**
 * El resumen del mes: entró, se fue, quedó.
 *
 * Por qué existe: el dueño necesita mirar una sola hoja y entender cómo viene,
 * y además poder mostrársela a alguien de afuera —sus padres— sin tener que
 * explicarla. Las pantallas que ya había contestaban partes de eso (Movimientos
 * el detalle, Rentabilidad el margen por cuenta), pero ninguna decía la frase
 * completa.
 *
 * Todo acá es puro y testeado. La serie mensual se arma en UN solo lugar para
 * que el resumen y Movimientos no puedan discrepar, que es el problema que ya
 * apareció una vez entre Finanzas y Cobros.
 */

/** Un movimiento ya convertido a pesos, listo para sumar. */
export interface MovimientoARS {
  /** YYYY-MM-DD. */
  fecha: string;
  montoARS: number;
  /** De dónde sale: lo que cobrás, lo que le pagás al equipo, o el resto. */
  tipo: "cobro" | "equipo" | "gasto";
}

export interface MesResumen {
  periodo: string;
  entro: number;
  equipo: number;
  gastos: number;
  /** equipo + gastos. */
  salio: number;
  /** entro − salio. */
  quedo: number;
  /** Qué porcentaje de lo que entró te quedó. 0 si no entró nada. */
  pctQuedo: number;
}

/** Los últimos `cantidad` períodos terminando en `hasta`, del más viejo al más nuevo. */
export function ultimosPeriodos(hasta: string, cantidad: number): string[] {
  const out: string[] = [];
  let [y, m] = hasta.split("-").map(Number);
  for (let i = 0; i < cantidad; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * La serie mes a mes. Los movimientos fuera de los períodos pedidos se ignoran,
 * así que se le puede pasar el historial entero sin filtrar antes.
 */
export function armarSerie(periodos: string[], movs: MovimientoARS[]): MesResumen[] {
  const base = new Map<string, MesResumen>();
  for (const p of periodos) {
    base.set(p, { periodo: p, entro: 0, equipo: 0, gastos: 0, salio: 0, quedo: 0, pctQuedo: 0 });
  }
  for (const mv of movs) {
    const row = base.get(mv.fecha.slice(0, 7));
    if (!row) continue;
    if (mv.tipo === "cobro") row.entro += mv.montoARS;
    else if (mv.tipo === "equipo") row.equipo += mv.montoARS;
    else row.gastos += mv.montoARS;
  }
  return periodos.map((p) => {
    const r = base.get(p)!;
    r.salio = r.equipo + r.gastos;
    r.quedo = r.entro - r.salio;
    r.pctQuedo = r.entro > 0 ? (r.quedo / r.entro) * 100 : 0;
    return r;
  });
}

export interface Comparado {
  mes: MesResumen;
  /** El mes anterior, si hay. */
  anterior: MesResumen | null;
  /** Diferencia de lo que quedó contra el mes anterior. */
  delta: number;
  /** Promedio de lo que quedó en los meses CON movimiento (sin contar los vacíos). */
  promedio: number;
  /** Cuántos meses con movimiento entraron en el promedio. */
  mesesConMovimiento: number;
  /** Lo que quedó, sumando todos los meses de la serie. */
  acumulado: number;
}

/**
 * Pone el mes en contexto. Los meses vacíos no entran en el promedio: un mes
 * sin cargar tiraría el promedio para abajo y haría parecer que el negocio
 * anda peor de lo que anda.
 */
export function compararMes(serie: MesResumen[], periodo: string): Comparado | null {
  const i = serie.findIndex((m) => m.periodo === periodo);
  if (i < 0) return null;
  const mes = serie[i];
  const anterior = i > 0 ? serie[i - 1] : null;
  const conMov = serie.filter((m) => m.entro > 0 || m.salio > 0);
  const promedio = conMov.length ? conMov.reduce((a, m) => a + m.quedo, 0) / conMov.length : 0;
  return {
    mes,
    anterior,
    delta: anterior ? mes.quedo - anterior.quedo : 0,
    promedio,
    mesesConMovimiento: conMov.length,
    acumulado: serie.reduce((a, m) => a + m.quedo, 0),
  };
}

/**
 * La frase en castellano que va arriba de todo.
 *
 * Es lo que hace que la hoja se entienda sola. Está escrita para que la lea
 * alguien que no conoce el negocio: sin porcentajes sueltos, sin jerga, y
 * diciendo qué significa el número, no solo cuál es.
 */
export function frase(c: Comparado): string {
  const { mes } = c;
  const plata = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;

  if (mes.entro === 0 && mes.salio === 0) {
    return "Todavía no hay movimientos cargados en este mes.";
  }
  if (mes.quedo < 0) {
    return `Este mes la agencia gastó ${plata(mes.quedo)} más de lo que cobró. Entraron ${plata(
      mes.entro
    )} y se fueron ${plata(mes.salio)} en sueldos y gastos.`;
  }

  const porCien = Math.round((mes.quedo / mes.entro) * 100);
  let f =
    `De cada $100 que cobró la agencia este mes, quedaron $${porCien} ` +
    `después de pagarle al equipo y cubrir los gastos.`;

  if (c.anterior && (c.anterior.entro > 0 || c.anterior.salio > 0)) {
    if (c.delta > 0) f += ` Quedó ${plata(c.delta)} más que el mes pasado.`;
    else if (c.delta < 0) f += ` Quedó ${plata(c.delta)} menos que el mes pasado.`;
    else f += " Quedó lo mismo que el mes pasado.";
  }
  return f;
}

/**
 * Cuántos meses de estructura tenés cubiertos con lo que quedó.
 *
 * Es la respuesta a "de cuánta plata dispongo": no el saldo, sino cuánto podés
 * aguantar si dejara de entrar plata mañana.
 */
export function mesesDeAire(quedoAcumulado: number, costoFijoMensual: number): number | null {
  if (costoFijoMensual <= 0) return null;
  return Math.max(0, quedoAcumulado) / costoFijoMensual;
}
