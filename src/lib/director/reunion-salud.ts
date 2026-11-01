/**
 * La reunión en el semáforo (1/11/2026). Las cuentas que se fueron casi no tenían
 * reunión con el cliente, y sin embargo pesaba 1 punto y recién después del día
 * 18 del mes: casi todo el rojo venía de tareas vencidas. Ahora mira cuánto hace
 * de la última, sin depender del día del mes.
 */
export const DIAS_SIN_REUNION = 45;

export function alertaReunion(
  diasCuenta: number,
  diasDesdeUltima: number | null
): { puntos: number; texto: string } | null {
  if (diasCuenta < DIAS_SIN_REUNION) return null;
  if (diasDesdeUltima === null) return { puntos: 2, texto: "Nunca tuvo una reunión registrada" };
  if (diasDesdeUltima >= DIAS_SIN_REUNION) return { puntos: 2, texto: `Hace ${diasDesdeUltima} días sin reunión` };
  return null;
}
