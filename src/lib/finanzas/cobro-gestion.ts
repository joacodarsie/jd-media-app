/**
 * Seguimiento del cobro de un abono: en qué etapa está y cuánto entregó.
 *
 * Por qué existe: el cobro era binario (pagó / no pagó) y la vida real pasa en
 * el medio — le escribiste y no contestó, quedó en pagarte el viernes, o te
 * dejó la mitad. Eso vivía en la cabeza del dueño, así que a fin de mes no se
 * sabía a quién insistirle ni cuánto faltaba de verdad.
 *
 * Puro y testeado: de acá salen el saldo, la etapa que se muestra y el total
 * que la pantalla informa como "falta cobrar".
 */

export type EtapaCobro = "pendiente" | "contactado" | "prometio" | "parcial" | "cobrado";

export interface EtapaMeta {
  value: EtapaCobro;
  label: string;
  /** Qué significa, para el que la elige. */
  ayuda: string;
  badge: string;
}

export const ETAPAS: EtapaMeta[] = [
  {
    value: "pendiente",
    label: "Sin contactar",
    ayuda: "Todavía no le escribiste este mes.",
    badge: "bg-muted text-muted-foreground",
  },
  {
    value: "contactado",
    label: "Le escribí",
    ayuda: "Le mandaste el recordatorio y estás esperando.",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  {
    value: "prometio",
    label: "Prometió pagar",
    ayuda: "Te dio una fecha. Anotala en la aclaración.",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "parcial",
    label: "Pagó una parte",
    ayuda: "Entregó algo a cuenta y debe el resto.",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  {
    value: "cobrado",
    label: "Pagó todo",
    ayuda: "Está saldado.",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
];

export function etapaMeta(v: string | null | undefined): EtapaMeta {
  return ETAPAS.find((e) => e.value === v) ?? ETAPAS[0];
}

export interface PagoParcial {
  monto: number;
  fecha: string;
  nota?: string | null;
}

export interface EstadoCobro {
  /** Lo que ya entregó, sumando las entregas parciales. */
  entregado: number;
  /** Lo que todavía debe. Nunca negativo. */
  saldo: number;
  /** true cuando ya cubrió el total. */
  saldado: boolean;
  /** La etapa que se muestra, ya resuelta contra los pagos. */
  etapa: EtapaCobro;
}

/**
 * La etapa NO se cree ciegamente lo guardado: si hay pagos que cubren el total,
 * está cobrado aunque nadie haya tocado el selector; y si entregó algo pero no
 * todo, está en "pagó una parte". Los datos mandan sobre el clic.
 */
export function estadoDeCobro(opts: {
  monto: number;
  pagos: PagoParcial[];
  /** Etapa elegida a mano. */
  etapaGuardada?: string | null;
  /** Fecha de cobro sellada por el botón "me pagó" de siempre. */
  cobradoEl?: string | null;
}): EstadoCobro {
  const monto = Number.isFinite(opts.monto) ? Math.max(opts.monto, 0) : 0;
  const entregado = opts.pagos.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const saldado = !!opts.cobradoEl || (monto > 0 && entregado >= monto);
  const saldo = saldado ? 0 : Math.max(monto - entregado, 0);

  let etapa: EtapaCobro;
  if (saldado) etapa = "cobrado";
  else if (entregado > 0) etapa = "parcial";
  else {
    const guardada = ETAPAS.find((e) => e.value === opts.etapaGuardada)?.value;
    // "cobrado" y "parcial" guardados a mano no se respetan si los números no
    // los sostienen: si no, la pantalla dice cobrado y la plata no está.
    etapa = guardada && guardada !== "cobrado" && guardada !== "parcial" ? guardada : "pendiente";
  }
  return { entregado, saldo, saldado, etapa };
}

/** Lo que de verdad falta cobrar en el mes, descontando lo entregado a cuenta. */
export function totalPendiente(
  filas: { monto: number; pagos?: PagoParcial[]; cobradoEl?: string | null }[],
): number {
  return filas.reduce(
    (a, f) =>
      a + estadoDeCobro({ monto: f.monto, pagos: f.pagos ?? [], cobradoEl: f.cobradoEl }).saldo,
    0,
  );
}

/** Y lo que ya entró, contando las entregas parciales. */
export function totalCobrado(
  filas: { monto: number; pagos?: PagoParcial[]; cobradoEl?: string | null }[],
): number {
  return filas.reduce((a, f) => {
    const e = estadoDeCobro({ monto: f.monto, pagos: f.pagos ?? [], cobradoEl: f.cobradoEl });
    // Si se marcó cobrado sin cargar entregas, cuenta el monto completo.
    return a + (e.saldado && e.entregado === 0 ? f.monto : e.entregado);
  }, 0);
}
