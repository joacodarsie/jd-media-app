// Primer mes de una cuenta: el equipo cobra PROPORCIONAL a los días desde el
// arranque, igual que el cliente paga su primer mes (lib/finanzas/primer-mes).
//
// Antes la nómina pagaba el mes completo de CM, media buyer, coordinación y
// dirección creativa aunque la cuenta arrancara el 23: en octubre de 2026 eso
// eran ~$400.000 de más (Nico del Barba, Tienda Moffa, Amisty, Aruma, Global
// Business Lab, Dalhan). Y al mirar un mes viejo aparecían cuentas que todavía
// no existían. Así se venía liquidando a mano en la planilla de honorarios
// (CATCH, Nazar y Blasco por la mitad en septiembre).
//
// El contenido (diseño, edición) no se toca: ya se paga por lo publicado.

import type { PayrollLine, PayrollLineKind } from "../payroll";

/** Lo que se paga por tener la cuenta en el mes, no por una pieza hecha. */
const PRORRATEABLES = new Set<PayrollLineKind>([
  "cm",
  "media_buyer",
  "coordinacion",
  "coord_diseno",
  "override",
]);

export interface ArranqueEnPeriodo {
  /** 1 = mes completo, 0 = la cuenta todavía no había arrancado. */
  fraccion: number;
  dias: number;
  diasMes: number;
  /** Día de arranque, solo si arrancó dentro del período. */
  dia: number | null;
}

/** Qué parte del período tuvo la cuenta, contando el día de arranque. */
export function arranqueEnPeriodo(
  fechaInicio: string | null | undefined,
  periodo: string
): ArranqueEnPeriodo {
  const [y, m] = periodo.split("-").map(Number);
  const diasMes = new Date(y, m, 0).getDate();
  const completo = { fraccion: 1, dias: diasMes, diasMes, dia: null };
  if (!fechaInicio || !/^\d{4}-\d{2}-\d{2}/.test(fechaInicio)) return completo;

  const inicioPeriodo = fechaInicio.slice(0, 7);
  if (inicioPeriodo < periodo) return completo;
  if (inicioPeriodo > periodo) return { fraccion: 0, dias: 0, diasMes, dia: null };

  const dia = Math.min(Math.max(Number(fechaInicio.slice(8, 10)), 1), diasMes);
  const dias = diasMes - dia + 1;
  return { fraccion: dias / diasMes, dias, diasMes, dia: dias < diasMes ? dia : null };
}

/**
 * Ajusta las líneas fijas por cuenta al arranque de cada cuenta: saca las de
 * cuentas que arrancaron después del período y prorratea las del mes de
 * arranque. El resto de las líneas pasa igual.
 */
export function prorratearPorArranque(
  lines: PayrollLine[],
  inicioPorCliente: Map<string, string | null>,
  periodo: string
): PayrollLine[] {
  const out: PayrollLine[] = [];
  for (const line of lines) {
    if (!line.clienteId || !PRORRATEABLES.has(line.kind)) {
      out.push(line);
      continue;
    }
    const a = arranqueEnPeriodo(inicioPorCliente.get(line.clienteId), periodo);
    if (a.fraccion <= 0) continue;
    if (a.fraccion >= 1) {
      out.push(line);
      continue;
    }
    // El "· N de M días" del pase de cuentas sobra si son los mismos días: lo
    // dice el proporcional. Si hubo un pase de verdad, queda.
    const pase = line.concepto.match(/ · (\d+) de \d+ días$/);
    const concepto = pase && Number(pase[1]) >= a.dias ? line.concepto.slice(0, pase.index) : line.concepto;
    out.push({
      ...line,
      monto: Math.round(line.monto * a.fraccion),
      concepto: `${concepto} · proporcional desde el ${a.dia}/${Number(periodo.slice(5, 7))} (${a.dias} de ${a.diasMes} días)`,
    });
  }
  return out;
}
