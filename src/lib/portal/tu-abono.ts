/**
 * «Tu abono del mes» en el portal (19/10/2026): del 1 al 10 de cada mes, una
 * tarjeta con los datos para transferir y un botón «Ya pagué» que le arma a
 * la PM la tarea de confirmar el pago. Sin monto a propósito: los números de
 * la plataforma todavía no son confiables y un monto mal es peor que ninguno.
 */
export const ABONO_HASTA_DIA = 10;

export function mostrarAbono(i: { hoy: string; fechaInicio: string | null; pagado: boolean }): boolean {
  if (i.pagado || !i.fechaInicio) return false;
  const dia = Number(i.hoy.slice(8, 10));
  if (dia > ABONO_HASTA_DIA) return false;
  // La cuenta que arrancó este mismo mes ya pagó su primer mes al cerrar.
  return i.fechaInicio.slice(0, 7) < i.hoy.slice(0, 7);
}

export function clavePago(clienteId: string, periodo: string): string {
  return `pago:${clienteId}:${periodo}`;
}
