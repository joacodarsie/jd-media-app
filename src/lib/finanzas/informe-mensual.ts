import {
  productionBase,
  mbCost,
  serviceDeliveryCost,
  standaloneDesignCost,
  type AgencyRates,
  type AgencySettings,
  type PackParam,
  type RatePack,
} from "@/lib/coordinacion";

/**
 * El armado del informe mensual de finanzas.
 *
 * Por qué existe: el dueño dijo que la sección de Finanzas lo marea —doce
 * pantallas y no sabe a cuál entrar— y que le costaría menos confiar en un
 * documento. Tiene razón a medias: mover los datos a una planilla no los hace
 * más ciertos, pero un informe mensual sí resuelve cosas que la app no puede
 * (mandárselo al contador sin dar acceso, abrirlo sin loguearse, y sobre todo
 * obligar a mirar los números una vez por mes).
 *
 * La clave para que confíe está en `cuadres()`: las hojas tienen que cerrar
 * entre sí. Si el total de Cobros, el de Clientes y el "Entró" del Resumen
 * coinciden solos, no hace falta creerle a nadie — se verifica mirando.
 *
 * Todo acá es puro y testeado. El que lo convierte en .xlsx es `informe-xlsx`.
 */

const RATE_PACKS: string[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];

export function asPack(p: string | null | undefined): RatePack {
  return p && RATE_PACKS.includes(p) ? (p as RatePack) : "Personalizado";
}

/** Un servicio activo tal cual sale de la base, con lo que hace falta para costearlo. */
export interface ServicioInforme {
  cliente: string;
  clienteId: string;
  tipo: string;
  pack: string | null;
  monto_mensual: number | null;
  moneda: string | null;
  costo_override: number | null;
  costo_pct: number | null;
  costo_override_user: string | null;
  media_buyer_aplica: boolean | null;
  pack_detalle: Record<string, number> | null;
  /** Desde cuándo es cliente (fecha_inicio del cliente). */
  desde: string | null;
}

export interface FilaCliente {
  cliente: string;
  servicio: string;
  pack: string;
  abono: number;
  costoEntrega: number;
  /** Comisión de coordinación: es un % del abono, no del costo. */
  coordinacion: number;
  margen: number;
  margenPct: number;
  desde: string | null;
  /** Cuántos meses lleva la cuenta al cierre del período. */
  meses: number | null;
}

const TIPO_LABEL: Record<string, string> = {
  gestion_redes: "Gestión de redes",
  paid_media: "Gestión de pauta",
  diseno_grafico: "Diseño gráfico",
  edicion_audiovisual: "Edición audiovisual",
  branding: "Branding",
  web: "Desarrollo web",
  botly: "Botly",
};

/**
 * Cuántas piezas lleva un servicio por mes. Sale del pack de lista, o del
 * detalle cargado a mano cuando el pack es "Personalizado".
 */
export function piezasDelServicio(
  svc: ServicioInforme,
  packs: PackParam[]
): { posts: number; reels: number; portadas: number } {
  const d = svc.pack_detalle;
  if (d && (Number(d.posts) > 0 || Number(d.reels) > 0)) {
    const reels = Number(d.reels) || 0;
    return {
      posts: Number(d.posts) || 0,
      reels,
      portadas: d.portadas != null ? Number(d.portadas) || 0 : reels,
    };
  }
  const p = packs.find((x) => x.id === svc.pack);
  if (!p) return { posts: 0, reels: 0, portadas: 0 };
  const conPortadas = p as PackParam & { portadas?: number };
  return {
    posts: p.posts,
    reels: p.reels,
    portadas: conPortadas.portadas ?? p.reels,
  };
}

/** Meses completos entre `desde` y el cierre del período. */
export function mesesDeAntiguedad(desde: string | null, periodo: string): number | null {
  if (!desde) return null;
  const [dy, dm] = desde.slice(0, 7).split("-").map(Number);
  const [py, pm] = periodo.split("-").map(Number);
  if (!dy || !dm || !py || !pm) return null;
  return Math.max(0, (py - dy) * 12 + (pm - dm)) + 1;
}

/**
 * Una fila por servicio activo, con lo que deja.
 *
 * Usa el mismo modelo que el cotizador a propósito: si el informe y el
 * cotizador dieran márgenes distintos para la misma cuenta, no se le podría
 * creer a ninguno de los dos.
 */
export function filasClientes(
  servicios: ServicioInforme[],
  settings: AgencySettings,
  periodo: string
): FilaCliente[] {
  const r = settings.rates;
  const filas = servicios.map((svc) => {
    const abono = Number(svc.monto_mensual) || 0;
    const pack = asPack(svc.pack);
    let costoEntrega = 0;

    if (svc.tipo === "gestion_redes") {
      const { posts, reels, portadas } = piezasDelServicio(svc, settings.packs);
      costoEntrega = productionBase(pack, posts, reels, r, portadas);
      if (svc.media_buyer_aplica !== false) costoEntrega += mbCost(pack, r);
      // La coordinación de diseño cobra sobre el diseño del mes.
      const diseno = posts * r.diseno_pieza + portadas * (r.portada_reel ?? 0);
      costoEntrega += Math.round(diseno * (r.comision_coord_diseno ?? 0));
    } else if (svc.tipo === "paid_media") {
      costoEntrega = mbCost(pack, r);
    } else if (svc.tipo === "diseno_grafico") {
      costoEntrega = standaloneDesignCost(
        { monto_mensual: svc.monto_mensual, costo_override: svc.costo_override },
        r
      );
    } else {
      costoEntrega = serviceDeliveryCost(svc)?.monto ?? 0;
    }

    const coordinacion = Math.round(abono * (r.comision_coordinacion ?? 0));
    const margen = abono - costoEntrega - coordinacion;
    return {
      cliente: svc.cliente,
      servicio: TIPO_LABEL[svc.tipo] ?? svc.tipo,
      pack: svc.pack ?? "—",
      abono,
      costoEntrega: Math.round(costoEntrega),
      coordinacion,
      margen: Math.round(margen),
      margenPct: abono > 0 ? (margen / abono) * 100 : 0,
      desde: svc.desde,
      meses: mesesDeAntiguedad(svc.desde, periodo),
    };
  });
  // De mejor a peor: arriba las cuentas que dejan, abajo las que hay que
  // renegociar. Es la lista que el dueño necesita mirar.
  return filas.sort((a, b) => b.margenPct - a.margenPct);
}

export interface FilaEquipo {
  persona: string;
  /** periodo → lo cobrado ese mes. */
  porMes: Record<string, number>;
  total: number;
}

/** El equipo, una fila por persona y una columna por mes. */
export function filasEquipo(
  pagos: { persona: string; periodo: string; montoARS: number }[],
  periodos: string[]
): FilaEquipo[] {
  const m = new Map<string, Record<string, number>>();
  for (const p of pagos) {
    if (!periodos.includes(p.periodo)) continue;
    const fila = m.get(p.persona) ?? {};
    fila[p.periodo] = (fila[p.periodo] ?? 0) + p.montoARS;
    m.set(p.persona, fila);
  }
  return [...m.entries()]
    .map(([persona, porMes]) => ({
      persona,
      porMes,
      total: Object.values(porMes).reduce((a, v) => a + v, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface Cuadre {
  concepto: string;
  /** Lo que dice una hoja. */
  a: number;
  /** Lo que dice la otra. */
  b: number;
  hojaA: string;
  hojaB: string;
  /** true si coinciden (con una tolerancia de $1 por el redondeo). */
  cierra: boolean;
}

/**
 * Los controles cruzados del informe.
 *
 * Es lo que convierte una planilla en algo verificable: si los totales de dos
 * hojas distintas coinciden, el número no depende de confiar en quien lo armó.
 * Y si NO coinciden, el informe lo dice en vez de esconderlo.
 */
export function cuadres(opts: {
  entroResumen: number;
  sumaCobrosDelMes: number;
  equipoResumen: number;
  sumaEquipoDelMes: number;
  fijosResumen: number;
  sumaFijosDelMes: number;
}): Cuadre[] {
  const armar = (
    concepto: string,
    hojaA: string,
    a: number,
    hojaB: string,
    b: number
  ): Cuadre => ({
    concepto,
    hojaA,
    a: Math.round(a),
    hojaB,
    b: Math.round(b),
    cierra: Math.abs(Math.round(a) - Math.round(b)) <= 1,
  });

  return [
    armar("Lo que entró", "Resumen", opts.entroResumen, "Cobros", opts.sumaCobrosDelMes),
    armar("Lo que se le pagó al equipo", "Resumen", opts.equipoResumen, "Equipo", opts.sumaEquipoDelMes),
    armar("Los gastos fijos", "Resumen", opts.fijosResumen, "Gastos fijos", opts.sumaFijosDelMes),
  ];
}

/** Nombre del archivo que se descarga. */
export function nombreArchivo(periodo: string): string {
  return `JD Media — Finanzas al ${periodo}.xlsx`;
}

export type { AgencyRates };
