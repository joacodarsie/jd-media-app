import { estadoDePagoSueldo } from "./pago-sueldo";

/**
 * Cerrar el mes: dejar registrado lo que se pagó.
 *
 * Por qué existe: la app ya calculaba la nómina y ya generaba sola los gastos
 * fijos del mes desde las suscripciones (ver `fixed-expenses.ts`). Lo que
 * faltaba era el último paso —marcarlos como PAGADOS— y sin eso julio, agosto y
 * septiembre de 2026 figuraban con $0 de egresos y "quedó el 100% de lo que
 * entró", que es falso.
 *
 * Los gastos fijos se pueden dar por pagados sin preguntar: son débitos
 * automáticos de las suscripciones. Los sueldos NO: varían, pueden quedar a
 * medias, y darlos por pagados sin que el dueño lo confirme sería inventar un
 * dato financiero. Por eso van con un botón que él aprieta.
 *
 * Esta parte es pura y testeada; el que escribe en la base es `cierre-mes-run`.
 */

export interface PersonaParaCerrar {
  userId: string;
  nombre: string;
  /** Lo que hay que pagarle este mes. */
  total: number;
  registrado: boolean;
  montoPagado?: number;
  fechaPago?: string | null;
}

export interface GastoFijoPendiente {
  id: string;
  concepto: string;
  /** Ya convertido a pesos, para poder sumarlo con los sueldos. */
  montoARS: number;
}

export interface PagoACerrar {
  userId: string;
  nombre: string;
  /** Lo que queda por registrar como pagado. */
  monto: number;
}

export interface PlanCierre {
  /** A quiénes hay que registrarles el pago. */
  pagos: PagoACerrar[];
  totalEquipo: number;
  /** Los ids de los gastos fijos que hay que sellar como pagados. */
  gastosIds: string[];
  totalGastos: number;
  /** Nada que hacer: el mes ya estaba cerrado. */
  nadaQueHacer: boolean;
}

/**
 * Qué falta registrar para que el mes quede cerrado.
 *
 * Una persona entra si tiene algo a cobrar y su sueldo no está saldado. Los
 * parciales entran por el TOTAL: sellar la fecha de pago significa "se pagó
 * todo", que es justamente lo que el botón afirma.
 */
export function planDeCierre(opts: {
  personas: PersonaParaCerrar[];
  gastosPendientes: GastoFijoPendiente[];
}): PlanCierre {
  const pagos: PagoACerrar[] = [];

  for (const p of opts.personas) {
    if (p.total <= 0) continue;
    const estado = estadoDePagoSueldo({
      total: p.total,
      registrado: p.registrado,
      montoPagado: p.montoPagado,
      fechaPago: p.fechaPago,
    });
    if (estado.estado === "pagado") continue;
    pagos.push({ userId: p.userId, nombre: p.nombre, monto: Math.round(p.total) });
  }

  return {
    pagos,
    totalEquipo: pagos.reduce((a, p) => a + p.monto, 0),
    gastosIds: opts.gastosPendientes.map((g) => g.id),
    totalGastos: Math.round(opts.gastosPendientes.reduce((a, g) => a + g.montoARS, 0)),
    nadaQueHacer: pagos.length === 0 && opts.gastosPendientes.length === 0,
  };
}

/**
 * Con qué fecha se sella el pago.
 *
 * Un mes ya cerrado se sella el último día de ese mes: poner la fecha de hoy
 * mandaría el gasto de julio al mes de septiembre y descuadraría los dos meses.
 * El mes en curso se sella hoy.
 */
export function fechaDeCierre(periodo: string, hoy: string): string {
  if (hoy.startsWith(periodo)) return hoy;
  const [y, m] = periodo.split("-").map(Number);
  // El día 0 del mes siguiente es el último del mes pedido.
  const ultimo = new Date(Date.UTC(y, m, 0));
  return ultimo.toISOString().slice(0, 10);
}
