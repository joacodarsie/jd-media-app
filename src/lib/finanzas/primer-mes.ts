/**
 * Cobro del PRIMER MES de un cliente nuevo.
 *
 * Política vigente (2026-08): se cobra proporcional a los días que quedan del
 * mes desde la fecha de arranque, contando el día de inicio. Además la primera
 * semana no lleva contenido publicado — es la semana de organización
 * (diagnóstico, manual de marca, perfiles y calendario), tal como figura en la
 * carta acuerdo.
 *
 * Reemplaza a la política de 2026-06, que cobraba el mes completo sin
 * prorratear. Si vuelve a cambiar, se cambia acá y en el texto del mensaje de
 * cobro (`buildPaymentMessage`).
 */

export interface PrimerMesCobro {
  /** Días que se cobran, incluido el día de inicio. */
  diasRestantes: number;
  /** Días que tiene el mes de arranque (28, 29, 30 o 31). */
  diasMes: number;
  /** true si arranca después del día 1 y por lo tanto se prorratea. */
  esProporcional: boolean;
  /** Lo que se le cobra este primer mes, redondeado al peso. */
  montoEsteMes: number;
}

/**
 * @param montoMensual  Monto mensual ya con descuentos aplicados.
 * @param fechaInicioIso Fecha de arranque "YYYY-MM-DD". Si es null, se asume
 *                       mes completo (todavía no se definió el arranque).
 */
export function calcularPrimerMes(
  montoMensual: number,
  fechaInicioIso: string | null
): PrimerMesCobro {
  const monto = Number.isFinite(montoMensual) ? Math.max(montoMensual, 0) : 0;

  if (!fechaInicioIso || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioIso)) {
    return { diasRestantes: 30, diasMes: 30, esProporcional: false, montoEsteMes: monto };
  }

  const [y, m, d] = fechaInicioIso.split("-").map(Number);
  // Día 0 del mes siguiente = último día de este mes. Cubre febrero y bisiestos.
  const diasMes = new Date(y, m, 0).getDate();
  const dia = Math.min(Math.max(d, 1), diasMes);

  const diasRestantes = diasMes - dia + 1;
  const esProporcional = diasRestantes < diasMes;

  return {
    diasRestantes,
    diasMes,
    esProporcional,
    montoEsteMes: esProporcional ? Math.round((monto / diasMes) * diasRestantes) : monto,
  };
}
