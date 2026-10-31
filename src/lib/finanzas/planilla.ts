/**
 * Lo que baja la planilla personal "Finanzas de Joaquín" desde la app (31/10/2026).
 *
 * La planilla lleva la plata real (cuentas, tarjetas, gasto personal) y la app
 * sabe lo de la agencia: qué se facturó cada mes, cuánto cuesta el equipo de
 * cada cuenta y quién debe. Antes esos números se copiaban a mano y quedaban
 * viejos (los abonos de la "Caja", los márgenes por cliente, los clientes
 * activos). Ahora el script de la planilla los pide acá todos los días.
 *
 * Dos miradas del mismo mes, a propósito:
 *  - FACTURADO: lo que corresponde al mes (el período de cada factura). Es lo
 *    que mide si el negocio anda: un cliente que paga dos meses juntos no
 *    infla un mes y vacía el siguiente. Con esto se calcula el sueldo.
 *  - COBRADO: lo que entró ese mes. Es lo que mide la caja.
 *
 * Puro y testeado: no toca la base.
 */

import type { FilaCliente } from "./informe-mensual";
import type { FilaCobro } from "./informe-xlsx";
import type { MesResumen } from "./resumen";

export interface FacturaPlanilla {
  periodo: string;
  montoARS: number;
}

export interface MesPlanilla {
  periodo: string;
  facturado: number;
  cobrado: number;
  equipo: number;
  gastos: number;
  /** facturado − equipo − gastos: lo que dejó el mes, antes del sueldo del dueño. */
  resultado: number;
  /** resultado / facturado. 0 si no se facturó nada. */
  margen: number;
}

export interface ClientePlanilla {
  cliente: string;
  pack: string;
  abono: number;
  /** Lo que se le paga al equipo por la cuenta, coordinación incluida. */
  costo: number;
  margen: number;
  margenPct: number;
  desde: string | null;
}

export interface DeudaPlanilla {
  cliente: string;
  periodo: string;
  saldo: number;
}

export interface Planilla {
  generadoEl: string;
  periodo: string;
  dolar: number;
  meses: MesPlanilla[];
  /** Un cliente por fila (varios servicios de un cliente se suman). Del peor margen al mejor. */
  clientes: ClientePlanilla[];
  /** Lo que se le va a pagar al equipo el 7 por el mes en curso, según la nómina calculada. */
  nominaDelMes: number;
  porCobrar: DeudaPlanilla[];
  /** Lo facturado en los últimos 12 meses: lo que mira el monotributo. */
  facturado12m: number;
}

const redondo = (n: number) => Math.round(n);

/** Suma lo facturado por período. */
export function facturadoPorPeriodo(facturas: FacturaPlanilla[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of facturas) out.set(f.periodo, (out.get(f.periodo) ?? 0) + (f.montoARS || 0));
  return out;
}

/** La serie del informe (por lo cobrado) con lo facturado al lado. */
export function mesesPlanilla(serie: MesResumen[], facturado: Map<string, number>): MesPlanilla[] {
  return serie.map((m) => {
    const fact = facturado.get(m.periodo) ?? 0;
    const resultado = fact - m.equipo - m.gastos;
    return {
      periodo: m.periodo,
      facturado: redondo(fact),
      cobrado: redondo(m.entro),
      equipo: redondo(m.equipo),
      gastos: redondo(m.gastos),
      resultado: redondo(resultado),
      margen: fact > 0 ? Math.round((resultado / fact) * 1000) / 1000 : 0,
    };
  });
}

/** Junta los servicios de cada cliente en una fila y ordena del peor margen al mejor. */
export function clientesPlanilla(filas: FilaCliente[]): ClientePlanilla[] {
  const porCliente = new Map<string, ClientePlanilla>();
  for (const f of filas) {
    const costo = (f.costoEntrega || 0) + (f.coordinacion || 0);
    const prev = porCliente.get(f.cliente);
    if (!prev) {
      porCliente.set(f.cliente, {
        cliente: f.cliente,
        pack: f.pack,
        abono: f.abono || 0,
        costo,
        margen: 0,
        margenPct: 0,
        desde: f.desde,
      });
    } else {
      prev.abono += f.abono || 0;
      prev.costo += costo;
      if (f.pack && !prev.pack.includes(f.pack)) prev.pack = prev.pack ? `${prev.pack} + ${f.pack}` : f.pack;
    }
  }
  return [...porCliente.values()]
    .map((c) => {
      const margen = c.abono - c.costo;
      return {
        ...c,
        abono: redondo(c.abono),
        costo: redondo(c.costo),
        margen: redondo(margen),
        margenPct: c.abono > 0 ? Math.round((margen / c.abono) * 1000) / 1000 : 0,
      };
    })
    .sort((a, b) => a.margenPct - b.margenPct);
}

/** Lo que falta cobrar, de cualquier mes. */
export function deudasPlanilla(cobros: FilaCobro[]): DeudaPlanilla[] {
  return cobros
    .filter((c) => !c.cobrado && c.saldo > 0)
    .map((c) => ({ cliente: c.cliente, periodo: c.periodo, saldo: redondo(c.saldo) }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || b.saldo - a.saldo);
}

/** Lo facturado en los 12 meses que terminan en `periodo`, inclusive. */
export function facturadoUltimos12(facturado: Map<string, number>, periodo: string): number {
  const [y, m] = periodo.split("-").map(Number);
  const desde = `${m === 12 ? y : y - 1}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  let total = 0;
  for (const [p, v] of facturado) if (p >= desde && p <= periodo) total += v;
  return redondo(total);
}
