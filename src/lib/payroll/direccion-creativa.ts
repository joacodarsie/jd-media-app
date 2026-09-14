// La Dirección Creativa (Brisa), como quedó en su acuerdo de rol del 14/9/2026:
// un % del abono de gestión de redes de CADA cuenta activa, todos los meses. Es
// el mismo modelo que la coordinación de la Project Manager (Luz).
//
// Reemplaza a la vieja "coordinación de diseño" (5% del diseño publicado + plus
// por manual de marca aprobado), que en septiembre de 2026 le dejaba $3.400 por
// aprobar el trabajo de toda la agencia: el incentivo estaba al revés del rol.
//
// El rol arranca el 15/9/2026, así que septiembre se paga por la mitad.
//
// Pasa al 10% (lo mismo que Luz) cuando cumpla tres meses los números del rol Y
// la agencia tenga 20 cuentas activas. Eso NO está automatizado a propósito: es
// una decisión que se toma en la revisión, y se aplica cambiando el % en
// Coordinación.

import type { PayrollClient, PayrollLine } from "../payroll";

/** Primer período en que se paga la dirección creativa (y deja de pagarse la coordinación de diseño). */
export const DIRECCION_CREATIVA_DESDE = "2026-09";

/** Qué parte del mes se paga: el de arranque va por la mitad porque el rol empezó el día 15. */
export function fraccionDelMes(periodo: string): number {
  if (periodo < DIRECCION_CREATIVA_DESDE) return 0;
  return periodo === DIRECCION_CREATIVA_DESDE ? 0.5 : 1;
}

/**
 * Una línea por cuenta: `pct` del abono de gestión de redes, por la fracción del
 * mes que corresponde. `clients` ya viene filtrado a las activas y no pausadas.
 */
export function computeDireccionCreativaLines(
  clients: PayrollClient[],
  gdrByClient: Map<string, number>,
  pct: number,
  periodo: string
): PayrollLine[] {
  const fraccion = fraccionDelMes(periodo);
  if (pct <= 0 || fraccion <= 0) return [];
  const pctTxt = `${Math.round(pct * 1000) / 10}%`;
  const out: PayrollLine[] = [];
  for (const c of clients) {
    const abono = gdrByClient.get(c.id) ?? 0;
    if (abono <= 0) continue;
    const monto = Math.round(abono * pct * fraccion);
    if (monto <= 0) continue;
    out.push({
      clienteId: c.id,
      cliente: c.nombre,
      concepto:
        fraccion < 1
          ? `Dirección creativa (${pctTxt}) · medio mes, arranca el 15`
          : `Dirección creativa (${pctTxt})`,
      monto,
      kind: "coord_diseno",
    });
  }
  return out;
}
