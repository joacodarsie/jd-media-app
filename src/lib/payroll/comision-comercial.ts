// La comisión del comercial, tal como está en el acuerdo firmado con Santiago
// Reinaldi el 14/9/2026 ("JD Media - Rol Coordinador Comercial"):
//
//   · Cliente nuevo, mes 1 → 10% del abono, cuando entra el primer pago.
//   · Cliente nuevo, meses 2 a 6 → 5% del abono cada mes, MIENTRAS EL CLIENTE
//     SIGA. Si se va, se corta. Termina en el mes 6.
//   · Servicio extra a un cliente que ya está activo → 15% de una sola vez
//     sobre lo que pague ese servicio.
//   · Premios del mes: 3 cuentas nuevas → $50.000 · 5 cuentas nuevas → $150.000.
//     No se acumulan (se cobra el más alto). Cuentan solo cuentas nuevas de
//     gestión de redes con abono de $300.000 o más. Arranca de cero cada mes.
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
  | "comision_residual"
  | "comision_residual_meses"
  | "comision_servicio_extra"
  | "premio_3_cuentas"
  | "premio_5_cuentas"
  | "premio_abono_minimo"
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
 * Las comisiones por CLIENTE NUEVO del período: el 10% el mes 1 y el residual
 * del mes 2 al 6, para quien figura como `cerrado_por_id`.
 *
 * `clients` tiene que venir ya filtrado a las cuentas ACTIVAS del período (así
 * "mientras el cliente siga" sale solo: la cuenta que se fue no está en la
 * lista y el residual se corta). `hasManualCommission` evita duplicar cuando
 * ya se cargó a mano una comisión para esa cuenta ese mes.
 */
export function selectCloserCommissions(
  clients: PayrollClient[],
  recurringByClient: Map<string, number>,
  periodo: string,
  rates: ComisionRates,
  hasManualCommission: (clienteId: string) => boolean
): LineaComision[] {
  const cierre = rates.comision_cierre ?? 0;
  const residual = rates.comision_residual ?? 0;
  const ultimoMes = 1 + Math.max(0, Math.round(rates.comision_residual_meses ?? 0));
  const out: LineaComision[] = [];
  for (const c of clients) {
    if (!c.cerrado_por_id) continue;
    const mes = mesDelCliente(c.fecha_inicio, periodo);
    if (mes === null || mes > ultimoMes) continue;
    if (hasManualCommission(c.id)) continue;
    const base = recurringByClient.get(c.id) ?? 0;
    if (base <= 0) continue;
    const pct = mes === 1 ? cierre : residual;
    if (pct <= 0) continue;
    out.push({
      closerId: c.cerrado_por_id,
      clienteId: c.id,
      cliente: c.nombre,
      base,
      pct,
      monto: Math.round(base * pct),
      concepto:
        mes === 1
          ? `Comisión cliente nuevo (${pctTxt(pct)}) · mes 1`
          : `Comisión cliente nuevo (${pctTxt(pct)}) · mes ${mes} de ${ultimoMes}`,
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

export interface PremioComercial {
  closerId: string;
  cuentas: number;
  monto: number;
  concepto: string;
}

/**
 * El premio del mes por cantidad de cuentas nuevas de gestión de redes con
 * abono ≥ mínimo, por closer. No acumulativo: el más alto que alcanzó.
 */
export function selectCloserPrizes(
  clients: PayrollClient[],
  services: Pick<ServicioComision, "cliente_id" | "tipo" | "monto_mensual" | "facturacion">[],
  periodo: string,
  rates: ComisionRates
): PremioComercial[] {
  const minimo = rates.premio_abono_minimo ?? 0;
  const premio3 = rates.premio_3_cuentas ?? 0;
  const premio5 = rates.premio_5_cuentas ?? 0;
  if (premio3 <= 0 && premio5 <= 0) return [];

  // Abono mensual de gestión de redes por cuenta.
  const redesByClient = new Map<string, number>();
  for (const s of services) {
    if (s.tipo !== "gestion_redes") continue;
    if ((s.facturacion ?? "mensual") === "unico") continue;
    redesByClient.set(s.cliente_id, (redesByClient.get(s.cliente_id) ?? 0) + (Number(s.monto_mensual) || 0));
  }

  const porCloser = new Map<string, number>();
  for (const c of clients) {
    if (!c.cerrado_por_id) continue;
    if (mesDelCliente(c.fecha_inicio, periodo) !== 1) continue;
    if ((redesByClient.get(c.id) ?? 0) < minimo) continue;
    porCloser.set(c.cerrado_por_id, (porCloser.get(c.cerrado_por_id) ?? 0) + 1);
  }

  const out: PremioComercial[] = [];
  for (const [closerId, cuentas] of porCloser) {
    const monto = cuentas >= 5 && premio5 > 0 ? premio5 : cuentas >= 3 && premio3 > 0 ? premio3 : 0;
    if (monto <= 0) continue;
    out.push({
      closerId,
      cuentas,
      monto,
      concepto: `Premio del mes · ${cuentas} cuentas nuevas`,
    });
  }
  return out;
}

function pctTxt(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}
