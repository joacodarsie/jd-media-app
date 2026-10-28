// Qué cuentas entran en la nómina de un período, mirando cuándo se dieron de
// baja (clients.fecha_inactivado) y no solo el estado de hoy.
//
// - Antes del mes de la baja la cuenta se liquida entera, como cualquier otra:
//   así un mes viejo no pierde a Lubricentro o a Medialunas por haberse ido
//   después.
// - En el mes de la baja ya no se pagan los fijos (CM, media buyer,
//   coordinación), pero el contenido que se terminó de publicar ese mes sí se
//   le paga a quien lo hizo (diseño, edición).

export interface CuentaConEstado {
  estado?: string | null;
  fecha_inactivado?: string | null;
}

export function separarCuentasDelMes<T extends CuentaConEstado>(
  clients: T[],
  periodo: string
): { activas: T[]; bajas: T[] } {
  const activas: T[] = [];
  const bajas: T[] = [];
  for (const c of clients) {
    if (c.estado === "activo") {
      activas.push(c);
      continue;
    }
    const mesBaja = (c.fecha_inactivado ?? "").slice(0, 7);
    if (!mesBaja) continue; // sin fecha de baja (propuesta, en pausa…): afuera
    if (mesBaja > periodo) activas.push(c);
    else if (mesBaja === periodo) bajas.push(c);
  }
  return { activas, bajas };
}
