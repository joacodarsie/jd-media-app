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

/**
 * Un movimiento ya convertido a pesos, listo para sumar.
 *
 * Va con el PERÍODO al que pertenece, no con la fecha en que se movió la plata.
 * Los dos no coinciden y el que importa es el período: los clientes pagan por
 * adelantado del 1 al 5, y al equipo se le paga a mes vencido el 7 del mes
 * siguiente. Si el costo del equipo se contara cuando sale la transferencia,
 * septiembre parecería un mes buenísimo y octubre un desastre, cuando en
 * realidad es el mismo trabajo.
 */
export interface MovimientoARS {
  /** YYYY-MM: el mes al que pertenece, no cuándo se movió la plata. */
  periodo: string;
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
    const row = base.get(mv.periodo);
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
 * La cascada del mes: de lo que entró a lo que te queda a vos.
 *
 * Es el modelo que el dueño tiene en la cabeza y que la hoja no mostraba: cada
 * cliente deja un margen después de pagar su producción; con la suma de esos
 * márgenes se pagan los gastos fijos; lo que sobra es su sueldo. Antes la hoja
 * juntaba equipo y estructura en un solo "se fue", que escondía los dos
 * porcentajes que le importan.
 */
export interface Cascada {
  entro: number;
  /** Lo que costó producir: sueldos del equipo. */
  equipo: number;
  /** Lo que dejan las cuentas después de pagar su producción. */
  margenAgencia: number;
  /** % de lo que entró que queda como margen de la agencia. */
  margenPct: number;
  /** La estructura que se paga con ese margen. */
  fijos: number;
  fijosPct: number;
  /** Lo que sobra después de todo: el sueldo del dueño. */
  tuSueldo: number;
  tuSueldoPct: number;
}

export function cascada(mes: MesResumen): Cascada {
  const pct = (n: number) => (mes.entro > 0 ? (n / mes.entro) * 100 : 0);
  const margenAgencia = mes.entro - mes.equipo;
  return {
    entro: mes.entro,
    equipo: mes.equipo,
    margenAgencia,
    margenPct: pct(margenAgencia),
    fijos: mes.gastos,
    fijosPct: pct(mes.gastos),
    tuSueldo: margenAgencia - mes.gastos,
    tuSueldoPct: pct(margenAgencia - mes.gastos),
  };
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
