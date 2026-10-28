// Qué cuentas entran en la nómina de un período, mirando cuándo se dieron de
// baja (clients.fecha_inactivado) y no solo el estado de hoy.
//
// - Antes del mes de la baja la cuenta se liquida entera, como cualquier otra:
//   así un mes viejo no pierde a Lubricentro o a Medialunas por haberse ido
//   después.
// - En el mes de la baja ya no se pagan los fijos (CM, media buyer,
//   coordinación), pero el contenido que se terminó de publicar ese mes sí se
//   le paga a quien lo hizo (diseño, edición).
//
// Una cuenta EN PAUSA se trata igual, con su fecha de pausa (migración 0223).
// Sin esa fecha queda afuera de todos los meses, como antes. Si después se
// reactivó (fecha_reactivacion, 0224), los meses entre la pausa y la vuelta
// no generan nómina; el de la vuelta se paga entero.

export interface CuentaConEstado {
  estado?: string | null;
  fecha_inactivado?: string | null;
  fecha_pausa?: string | null;
  fecha_reactivacion?: string | null;
}

export function separarCuentasDelMes<T extends CuentaConEstado>(
  clients: T[],
  periodo: string
): { activas: T[]; bajas: T[] } {
  const activas: T[] = [];
  const bajas: T[] = [];
  for (const c of clients) {
    if (c.estado === "activo") {
      const mesPausa = (c.fecha_pausa ?? "").slice(0, 7);
      const mesVuelta = (c.fecha_reactivacion ?? "").slice(0, 7);
      const huboPausa = !!mesPausa && !!mesVuelta && mesVuelta > mesPausa;
      if (huboPausa && periodo === mesPausa) bajas.push(c);
      else if (!huboPausa || periodo < mesPausa || periodo >= mesVuelta) activas.push(c);
      continue;
    }
    const fechaBaja = c.estado === "en_pausa" ? c.fecha_pausa : c.fecha_inactivado;
    const mesBaja = (fechaBaja ?? "").slice(0, 7);
    if (!mesBaja) continue; // sin fecha de baja (propuesta, en pausa…): afuera
    if (mesBaja > periodo) activas.push(c);
    else if (mesBaja === periodo) bajas.push(c);
  }
  return { activas, bajas };
}
