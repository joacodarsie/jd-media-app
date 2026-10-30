/**
 * El cotizador del área comercial: una versión simple del de Coordinación.
 *
 * La diferencia de fondo es qué muestra. El de Coordinación expone cuánto se
 * le paga al equipo y el margen de cada cuenta; eso no es información para el
 * que sale a vender. Acá el comercial ve lo mismo que va a ver el cliente —el
 * precio de lista de cada cosa, el descuento y el total— más lo que le toca a
 * él de comisión. Del costo solo le llega una cosa: **hasta cuánto puede
 * descontar sin que la cuenta pierda plata el primer mes**. Ese tope lo calcula
 * el servidor con las tarifas reales y al navegador solo viaja el número final.
 *
 * Reglas que vienen de otros lados y conviene no romper:
 *   · El pack de redes INCLUYE la gestión de pauta. Sin pauta, −$50.000
 *     (`DESCUENTO_SIN_PAUTA` en el alta del cliente).
 *   · La gestión de pauta suelta ($100.000) es para quien NO lleva redes.
 *   · El descuento se aplica sobre la gestión, no sobre los servicios extra.
 *   · Comisión (acuerdo vigente desde octubre 2026): 10% del abono el mes 1
 *     para quien cierra y 5% por mes desde el mes 2 mientras el cliente siga.
 *
 * Puro: no toca la base ni depende de React.
 */

import type { PackName } from "@/lib/coordinacion";

export const DESCUENTO_SIN_PAUTA = 50000;

/** Ids de la lista de precios que son packs de redes (se eligen aparte). */
export const IDS_PACKS = ["redes_presencia", "redes_crecimiento", "redes_escala"];

/** Servicios que se cobran una sola vez (el resto es mensual). */
export const IDS_UNA_VEZ = ["branding", "desarrollo_web", "jornada"];

/** La pauta suelta: solo tiene sentido sin pack de redes. */
export const ID_PAUTA_SUELTA = "paid_media";

export const HORA_EXTRA_JORNADA = 25000;

export interface PackComercial {
  id: PackName;
  precio: number;
  reels: number;
  posts: number;
  stories: number;
}

export interface ServicioComercial {
  id: string;
  nombre: string;
  precio: number;
  nota?: string;
}

/**
 * Lo mínimo que se puede cobrar la gestión de cada pack sin perder plata el
 * primer mes, con y sin pauta. Lo arma el servidor con las tarifas.
 */
export type MinimosPorPack = Partial<Record<PackName, { conPauta: number; sinPauta: number }>>;

export interface PropuestaComercial {
  pack: PackName | null;
  /** Solo cuenta si hay pack: el pack trae la pauta incluida. */
  conPauta: boolean;
  /** Ids de servicios de la lista, fuera de los packs. */
  servicios: string[];
  /** Horas de la jornada, si se suma. La primera va al precio de lista. */
  horasJornada: number;
  /** Descuento mensual sobre la gestión, en pesos. */
  descuento: number;
}

export interface LineaPrecio {
  nombre: string;
  detalle?: string;
  precio: number;
}

export interface ResultadoComercial {
  mensuales: LineaPrecio[];
  unaVez: LineaPrecio[];
  /** Lo que paga el cliente todos los meses. */
  abonoMensual: number;
  pagosUnicos: number;
  /** El primer mes: el abono más lo que es de una sola vez. */
  primerMes: number;
  /** El descuento que se aplicó de verdad (no puede pasar del máximo). */
  descuentoAplicado: number;
  /** Hasta cuánto se puede descontar. `null` = sin pack, no hay descuento. */
  descuentoMaximo: number | null;
  /** Se pidió más descuento del permitido y se recortó. */
  descuentoRecortado: boolean;
  comision: {
    /** Lo que cobra el mes 1, cuando entra el primer pago. */
    mes1: number;
    /** Lo que cobra por mes desde el mes 2, mientras el cliente siga. */
    mensual: number;
  };
}

/** Redondea para abajo a múltiplos de $5.000: un descuento de $37.400 no se ofrece. */
function aMultiplo(n: number): number {
  return Math.max(0, Math.floor(n / 5000) * 5000);
}

export function cotizarComercial(input: {
  propuesta: PropuestaComercial;
  packs: PackComercial[];
  servicios: ServicioComercial[];
  minimos: MinimosPorPack;
  pctCierre: number;
  pctCartera: number;
}): ResultadoComercial {
  const { propuesta: p, packs, servicios, minimos, pctCierre, pctCartera } = input;
  const mensuales: LineaPrecio[] = [];
  const unaVez: LineaPrecio[] = [];

  const pack = p.pack ? packs.find((x) => x.id === p.pack) ?? null : null;

  // ── La gestión de redes, con o sin pauta ──
  let gestion = 0;
  let descuentoMaximo: number | null = null;
  if (pack) {
    gestion = pack.precio - (p.conPauta ? 0 : DESCUENTO_SIN_PAUTA);
    const min = minimos[pack.id];
    const piso = min ? (p.conPauta ? min.conPauta : min.sinPauta) : gestion;
    descuentoMaximo = aMultiplo(gestion - piso);
    mensuales.push({
      nombre: `Gestión de redes · ${pack.id}`,
      detalle: `${pack.reels} reels, ${pack.posts} posteos y ${pack.stories} días de historias${
        p.conPauta ? " · incluye gestión de pauta" : " · sin pauta"
      }`,
      precio: gestion,
    });
  }

  const pedido = Math.max(0, Math.round(p.descuento || 0));
  const descuentoAplicado = descuentoMaximo === null ? 0 : Math.min(pedido, descuentoMaximo);
  if (descuentoAplicado > 0) {
    mensuales.push({ nombre: "Descuento", precio: -descuentoAplicado });
  }

  // ── Servicios de la lista ──
  for (const id of p.servicios) {
    if (IDS_PACKS.includes(id)) continue;
    // Con pack, la pauta ya viene incluida: no se cobra dos veces.
    if (id === ID_PAUTA_SUELTA && pack) continue;
    const s = servicios.find((x) => x.id === id);
    if (!s) continue;
    if (id === "jornada") {
      const horas = Math.max(1, Math.round(p.horasJornada || 1));
      unaVez.push({
        nombre: s.nombre,
        detalle: horas === 1 ? "1 hora, más viáticos" : `${horas} horas, más viáticos`,
        precio: s.precio + (horas - 1) * HORA_EXTRA_JORNADA,
      });
    } else if (IDS_UNA_VEZ.includes(id)) {
      unaVez.push({ nombre: s.nombre, detalle: s.nota, precio: s.precio });
    } else {
      mensuales.push({ nombre: s.nombre, detalle: s.nota, precio: s.precio });
    }
  }

  const abonoMensual = mensuales.reduce((a, l) => a + l.precio, 0);
  const pagosUnicos = unaVez.reduce((a, l) => a + l.precio, 0);

  return {
    mensuales,
    unaVez,
    abonoMensual,
    pagosUnicos,
    primerMes: abonoMensual + pagosUnicos,
    descuentoAplicado,
    descuentoMaximo,
    descuentoRecortado: descuentoMaximo !== null && pedido > descuentoMaximo,
    comision: {
      mes1: Math.round(abonoMensual * pctCierre),
      mensual: Math.round(abonoMensual * pctCartera),
    },
  };
}
