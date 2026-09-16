// La comisión del área comercial, tal como está en los acuerdos de Santiago
// Reinaldi y Matías Castello (versión del 16/9/2026):
//
//   · Cliente nuevo, mes 1 → 15% del abono, cuando entra el primer pago, para
//     quien cerró la cuenta (`cerrado_por_id`).
//   · CARTERA, desde el mes 2 → 5% del abono todos los meses para quien atiende
//     la cuenta (`responsable_id`), mientras el cliente siga y haya pagado ese
//     mes. Por defecto la atiende quien la cerró. Cada cuenta paga UN solo 5%:
//     si pasa a otra persona, el 5% pasa con ella.
//   · Servicio extra a un cliente que ya está activo → 15% de una sola vez
//     sobre lo que pague ese servicio.
//
// ⚠️ El 16/9/2026 se SACARON el residual de los meses 2-4 (pagaba un segundo
// 5% sobre la misma cuenta y no daban los márgenes) y los premios por cantidad
// de cuentas nuevas. No volver a sumarlos.
//
// Todo son funciones puras: la nómina (`payroll-period.ts`) les pasa las
// filas y ellas devuelven líneas. Los porcentajes y montos salen de
// `agency_settings.rates` para que el dueño los pueda tocar sin deploy.
//
// ⚠️ Los escalones progresivos por cantidad de cierres (15/17/18/20) se
// DESCARTARON en la revisión del 14/9: "marea bastante". No volver a sumarlos.

import type { AgencyRates } from "../coordinacion";
import type { PayrollClient } from "../payroll";

/** Recorte de `rates` que usa este módulo (el resto no le importa). */
export type ComisionRates = Pick<
  AgencyRates,
  | "comision_cierre"
  | "comision_cartera"
  | "comision_servicio_extra"
>;

/** Servicio de una cuenta, con lo que hace falta para pagar el extra. */
export interface ServicioComision {
  cliente_id: string;
  tipo: string;
  monto_mensual: number | null;
  facturacion: string | null;
  /** Desde cuándo se cobra. Si falta, se usa `created_at`. */
  fecha_inicio: string | null;
  created_at: string | null;
  /** Quién vendió ESTE servicio (no la cuenta). Sin esto no hay comisión. */
  vendido_por_id: string | null;
}

export interface LineaComision {
  closerId: string;
  clienteId: string;
  cliente: string;
  /** Sobre qué monto se calculó. */
  base: number;
  pct: number;
  monto: number;
  /** Texto para la nómina. */
  concepto: string;
}

/**
 * En qué mes de vida está la cuenta en `periodo` (1 = el mes de arranque).
 * null si todavía no arrancó o no tiene fecha.
 */
export function mesDelCliente(fechaInicio: string | null | undefined, periodo: string): number | null {
  const ini = (fechaInicio ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [iy, im] = ini.split("-").map(Number);
  const [py, pm] = periodo.split("-").map(Number);
  const diff = (py - iy) * 12 + (pm - im);
  return diff < 0 ? null : diff + 1;
}

/**
 * La comisión por CLIENTE NUEVO del período: el % del mes 1 para quien figura
 * como `cerrado_por_id`. Del mes 2 en adelante lo que se paga es la cartera
 * (`selectCarteraCommissions`), a quien atiende la cuenta.
 *
 * `clients` tiene que venir ya filtrado a las cuentas ACTIVAS del período.
 * `hasManualCommission` evita duplicar cuando ya se cargó a mano una comisión
 * para esa cuenta ese mes.
 */
export function selectCloserCommissions(
  clients: PayrollClient[],
  recurringByClient: Map<string, number>,
  periodo: string,
  rates: ComisionRates,
  hasManualCommission: (clienteId: string) => boolean
): LineaComision[] {
  const pct = rates.comision_cierre ?? 0;
  if (pct <= 0) return [];
  const out: LineaComision[] = [];
  for (const c of clients) {
    if (!c.cerrado_por_id) continue;
    if (mesDelCliente(c.fecha_inicio, periodo) !== 1) continue;
    if (hasManualCommission(c.id)) continue;
    const base = recurringByClient.get(c.id) ?? 0;
    if (base <= 0) continue;
    out.push({
      closerId: c.cerrado_por_id,
      clienteId: c.id,
      cliente: c.nombre,
      base,
      pct,
      monto: Math.round(base * pct),
      concepto: `Comisión cliente nuevo (${pctTxt(pct)}) · mes 1`,
    });
  }
  return out;
}

/**
 * La CARTERA: lo que cobra todos los meses quien ATIENDE la cuenta.
 *
 * Es la parte del acuerdo del 16/9/2026 que paga sostener al cliente, no
 * haberlo vendido: la reunión mensual, la relación y que renueve. Por eso mira
 * `responsable_id` y no `cerrado_por_id`, y por eso se corta sola cuando la
 * cuenta cambia de manos.
 *
 * Arranca en el MES 2: el mes 1 ya se paga como comisión de venta.
 *
 * Dos condiciones, las dos del acuerdo:
 *  - la cuenta está activa (si se fue, no viene en `clients`);
 *  - el cliente PAGÓ ese período (`pagoRegistrado`). Si no pagó, no se paga
 *    comisión por él: es lo que evita cerrar con quien sea.
 */
export function selectCarteraCommissions(
  clients: PayrollClient[],
  recurringByClient: Map<string, number>,
  periodo: string,
  rates: ComisionRates,
  pagoRegistrado: (clienteId: string) => boolean
): LineaComision[] {
  const pct = rates.comision_cartera ?? 0;
  if (pct <= 0) return [];
  const out: LineaComision[] = [];
  for (const c of clients) {
    if (!c.responsable_id) continue;
    const mes = mesDelCliente(c.fecha_inicio, periodo);
    if (mes === null || mes < 2) continue;
    if (!pagoRegistrado(c.id)) continue;
    const base = recurringByClient.get(c.id) ?? 0;
    if (base <= 0) continue;
    out.push({
      closerId: c.responsable_id,
      clienteId: c.id,
      cliente: c.nombre,
      base,
      pct,
      monto: Math.round(base * pct),
      concepto: `Cartera (${pctTxt(pct)}) · cuenta a su cargo`,
    });
  }
  return out;
}

/**
 * El 15% por SERVICIO EXTRA: un servicio que arranca este período en una
 * cuenta que ya estaba activa antes, vendido por alguien (`vendido_por_id`).
 * Se paga una sola vez, sobre el monto del servicio.
 *
 * Los servicios que nacen junto con la cuenta (mismo mes de arranque) NO son
 * extra: son la venta original y la paga `selectCloserCommissions`.
 */
export function selectUpsellCommissions(
  clients: PayrollClient[],
  services: ServicioComision[],
  periodo: string,
  rates: ComisionRates
): LineaComision[] {
  const pct = rates.comision_servicio_extra ?? 0;
  if (pct <= 0) return [];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const out: LineaComision[] = [];
  for (const s of services) {
    if (!s.vendido_por_id) continue;
    const arranque = (s.fecha_inicio ?? s.created_at ?? "").slice(0, 7);
    if (arranque !== periodo) continue;
    const c = clientById.get(s.cliente_id);
    if (!c) continue;
    const mesCuenta = mesDelCliente(c.fecha_inicio, periodo);
    // Sin fecha de inicio no se puede saber si es extra: no se paga por las dudas.
    if (mesCuenta === null || mesCuenta <= 1) continue;
    const base = Number(s.monto_mensual) || 0;
    if (base <= 0) continue;
    out.push({
      closerId: s.vendido_por_id,
      clienteId: c.id,
      cliente: c.nombre,
      base,
      pct,
      monto: Math.round(base * pct),
      concepto: `Comisión servicio extra (${pctTxt(pct)}) · ${s.tipo.replace(/_/g, " ")}`,
    });
  }
  return out;
}

function pctTxt(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}
