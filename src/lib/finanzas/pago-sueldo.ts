/**
 * Estado del pago de un sueldo. Puro y testeado.
 *
 * El pago de sueldos no es binario: en la planilla que el dueño lleva a mano,
 * agosto de Luz figuraba como "$879.300 total · $679.300 pagado · $200.000
 * falta". Sin lugar donde anotar eso, la app decía "registrado" y la verdad
 * seguía viviendo en la planilla.
 */

export type EstadoPagoSueldo = "sin_registrar" | "pendiente" | "parcial" | "pagado";

export interface EstadoSueldo {
  estado: EstadoPagoSueldo;
  /** Lo transferido hasta ahora. */
  pagado: number;
  /** Lo que falta. Nunca negativo. */
  falta: number;
  label: string;
  badge: string;
}

const BADGES: Record<EstadoPagoSueldo, string> = {
  sin_registrar: "bg-muted text-muted-foreground",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  parcial: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  pagado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function estadoDePagoSueldo(opts: {
  /** Lo que hay que pagarle este mes. */
  total: number;
  /** ¿Ya existe la fila del pago? */
  registrado: boolean;
  /** Lo transferido. */
  montoPagado?: number | null;
  /** Fecha de pago sellada por el botón de siempre. */
  fechaPago?: string | null;
}): EstadoSueldo {
  const total = Number.isFinite(opts.total) ? Math.max(opts.total, 0) : 0;
  const pagadoBruto = Number(opts.montoPagado ?? 0) || 0;

  // El botón viejo sella la fecha sin cargar monto: eso es "pagado todo".
  const saldado = !!opts.fechaPago || (total > 0 && pagadoBruto >= total);
  const pagado = saldado && pagadoBruto === 0 ? total : pagadoBruto;
  const falta = saldado ? 0 : Math.max(total - pagado, 0);

  let estado: EstadoPagoSueldo;
  if (!opts.registrado && pagado === 0 && !saldado) estado = "sin_registrar";
  else if (saldado) estado = "pagado";
  else if (pagado > 0) estado = "parcial";
  else estado = "pendiente";

  const label =
    estado === "pagado"
      ? "Pagado"
      : estado === "parcial"
        ? "Pagó una parte"
        : estado === "pendiente"
          ? "Registrado, sin pagar"
          : "Sin registrar";

  return { estado, pagado, falta, label, badge: BADGES[estado] };
}

/** Lo que todavía falta transferirle a todo el equipo este mes. */
export function faltaPagarDelMes(
  filas: { total: number; registrado: boolean; montoPagado?: number | null; fechaPago?: string | null }[],
): number {
  return filas.reduce((a, f) => a + estadoDePagoSueldo(f).falta, 0);
}
