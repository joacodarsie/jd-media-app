/**
 * Objetivos por persona, medidos solos con lo que pasa en la app.
 *
 * Pedido del dueño (5/10/2026): entró Mati Castello como comercial con un
 * objetivo de 600 leads por semana (2.400 por mes) y quiere ver cómo viene, y
 * la conversión de las propuestas. Y que todos los roles tengan los suyos.
 *
 * Regla: nadie carga avances a mano (el dueño no carga datos). Cada métrica sale
 * de un dato que ya existe; la meta, cuando no se puso una a mano, sale de lo
 * que se vendió (lo que piden los packs de las cuentas de esa persona).
 *
 * Puro: entra la data del período, sale el avance. Lo usa la pantalla.
 */

export type MetricaId =
  | "leads_contactados"
  | "reuniones_agendadas"
  | "propuestas_enviadas"
  | "cierres"
  | "conversion_propuestas"
  | "piezas_publicadas"
  | "piezas_diseno"
  | "piezas_edicion"
  | "reuniones_mensuales"
  | "calendario_aprobado";

export interface MetricaDef {
  id: MetricaId;
  label: string;
  /** Qué mide, en una línea. */
  ayuda: string;
  /** "%": el valor ya es un porcentaje. */
  unidad: "n" | "%";
  /** La meta se escribe a mano (si no, sale sola). */
  metaManual: boolean;
  /** Solo tiene sentido por mes. */
  soloMes?: boolean;
}

export const METRICAS: Record<MetricaId, MetricaDef> = {
  leads_contactados: {
    id: "leads_contactados",
    label: "Leads contactados",
    ayuda: "Contactos de prospección marcados como escritos por esta persona.",
    unidad: "n",
    metaManual: true,
  },
  reuniones_agendadas: {
    id: "reuniones_agendadas",
    label: "Reuniones agendadas",
    ayuda: "Contactos suyos que pasaron a reunión.",
    unidad: "n",
    metaManual: true,
  },
  propuestas_enviadas: {
    id: "propuestas_enviadas",
    label: "Propuestas enviadas",
    ayuda: "Propuestas armadas en la app por esta persona.",
    unidad: "n",
    metaManual: true,
  },
  cierres: {
    id: "cierres",
    label: "Clientes cerrados",
    ayuda: "Cuentas que se activaron con esta persona como quien cerró.",
    unidad: "n",
    metaManual: true,
  },
  conversion_propuestas: {
    id: "conversion_propuestas",
    label: "Conversión de propuestas",
    ayuda: "Clientes cerrados sobre propuestas enviadas en el mes.",
    unidad: "%",
    metaManual: true,
    soloMes: true,
  },
  piezas_publicadas: {
    id: "piezas_publicadas",
    label: "Piezas publicadas",
    ayuda: "Publicado en sus cuentas, contra lo planificado del período.",
    unidad: "n",
    metaManual: false,
  },
  piezas_diseno: {
    id: "piezas_diseno",
    label: "Piezas de diseño terminadas",
    ayuda: "Tareas de diseño cerradas, contra los posteos y carruseles de sus cuentas.",
    unidad: "n",
    metaManual: false,
  },
  piezas_edicion: {
    id: "piezas_edicion",
    label: "Videos editados",
    ayuda: "Tareas de edición cerradas, contra los reels y videos de sus cuentas.",
    unidad: "n",
    metaManual: false,
  },
  reuniones_mensuales: {
    id: "reuniones_mensuales",
    label: "Reuniones mensuales hechas",
    ayuda: "Cuentas activas con la reunión del mes registrada.",
    unidad: "n",
    metaManual: false,
    soloMes: true,
  },
  calendario_aprobado: {
    id: "calendario_aprobado",
    label: "Calendario aprobado",
    ayuda: "Piezas del período que ya salieron de idea (aprobadas).",
    unidad: "n",
    metaManual: false,
  },
};

export interface PersonaObj {
  id: string;
  nombre: string;
  rol: string;
  rol_secundario?: string | null;
  area?: string | null;
  area_secundaria?: string | null;
}

/** Qué se le mide a cada persona, según su rol y su área. */
export function metricasDe(p: PersonaObj): MetricaId[] {
  const roles = [p.rol, p.rol_secundario].filter(Boolean) as string[];
  const areas = [p.area, p.area_secundaria].filter(Boolean) as string[];
  const out: MetricaId[] = [];
  if (roles.some((r) => r === "comercial" || r === "prospecting") || areas.includes("Comercial")) {
    out.push("leads_contactados", "reuniones_agendadas", "propuestas_enviadas", "cierres", "conversion_propuestas");
  }
  if (areas.includes("Coordinación de Diseño")) out.push("calendario_aprobado");
  if (areas.includes("Coordinación")) out.push("reuniones_mensuales");
  if (roles.includes("community_manager")) out.push("piezas_publicadas");
  if (roles.includes("diseno")) out.push("piezas_diseno");
  if (roles.includes("audiovisual")) out.push("piezas_edicion");
  return out;
}

/* ---------------- Períodos ---------------- */

export interface Periodo {
  desde: string; // YYYY-MM-DD inclusive
  hasta: string; // YYYY-MM-DD exclusivo
  /** Días hábiles (lunes a viernes) del período y los que ya pasaron, hoy incluido. */
  dias: number;
  transcurridos: number;
  /** Hoy (YYYY-MM-DD): lo que "ya tenía que salir" es lo de antes de mañana. */
  hoy: string;
}

/** Días hábiles entre dos fechas [desde, hasta). */
function habiles(desde: string, hasta: string): number {
  let n = 0;
  for (let t = utc(desde); t < utc(hasta); t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
function utc(d: string): number {
  return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
}

/** La semana de lunes a domingo que contiene `hoy`. */
export function semanaDe(hoy: string): Periodo {
  const t = utc(hoy);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // lunes = 0
  const desde = ymd(t - dow * 86_400_000);
  const hasta = ymd(t + (7 - dow) * 86_400_000);
  const manana = ymd(t + 86_400_000);
  return { desde, hasta, dias: habiles(desde, hasta), transcurridos: Math.max(1, habiles(desde, manana)), hoy };
}

/** El mes calendario que contiene `hoy`. */
export function mesDe(hoy: string): Periodo {
  const y = +hoy.slice(0, 4);
  const m = +hoy.slice(5, 7);
  const desde = ymd(Date.UTC(y, m - 1, 1));
  const hasta = ymd(Date.UTC(y, m, 1));
  const manana = ymd(utc(hoy) + 86_400_000);
  return { desde, hasta, dias: habiles(desde, hasta), transcurridos: Math.max(1, habiles(desde, manana)), hoy };
}

const en = (f: string | null | undefined, p: Periodo) => !!f && f.slice(0, 10) >= p.desde && f.slice(0, 10) < p.hasta;

/* ---------------- Datos que entran ---------------- */

export interface DatosObjetivos {
  contactos: { asignado_a: string | null; contactado_at: string | null; reunion_at: string | null }[];
  propuestas: { creada_por_id: string | null; created_at: string }[];
  clientes: {
    id: string;
    estado: string;
    es_interno?: boolean | null;
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
    cerrado_por_id?: string | null;
    fecha_activado?: string | null;
  }[];
  publicaciones: { cliente_id: string; tipo: string; estado: string; fecha_publicacion: string | null }[];
  tareasCerradas: { asignado_a_id: string | null; area: string | null; fecha_completada: string | null }[];
  reunionesMensuales: { cliente_id: string; fecha: string }[];
}

export interface Avance {
  valor: number;
  meta: number | null;
  /** Lo que daría al terminar el período a este ritmo (solo conteos con meta). */
  proyeccion: number | null;
}

const DISENO = new Set(["post", "carrusel"]);
const EDICION = new Set(["reel", "video"]);

function contarMeta(
  m: MetricaId,
  persona: string,
  d: DatosObjetivos,
  p: Periodo
): { valor: number; metaAuto: number | null } {
  const activos = d.clientes.filter((c) => c.estado === "activo" && !c.es_interno);
  const pubsDe = (ids: Set<string>, filtro?: (tipo: string) => boolean) =>
    d.publicaciones.filter(
      (x) => ids.has(x.cliente_id) && en(x.fecha_publicacion, p) && x.estado !== "rechazado" && (!filtro || filtro(x.tipo))
    );
  switch (m) {
    case "leads_contactados":
      return { valor: d.contactos.filter((c) => c.asignado_a === persona && en(c.contactado_at, p)).length, metaAuto: null };
    case "reuniones_agendadas":
      return { valor: d.contactos.filter((c) => c.asignado_a === persona && en(c.reunion_at, p)).length, metaAuto: null };
    case "propuestas_enviadas":
      return { valor: d.propuestas.filter((x) => x.creada_por_id === persona && en(x.created_at, p)).length, metaAuto: null };
    case "cierres":
      return {
        valor: d.clientes.filter((c) => c.cerrado_por_id === persona && en(c.fecha_activado, p)).length,
        metaAuto: null,
      };
    case "piezas_publicadas": {
      // Contra lo que YA tenía que salir (hasta hoy): lo de más adelante
      // todavía no cuenta como atraso.
      const ids = new Set(activos.filter((c) => c.cm_id === persona).map((c) => c.id));
      const vencido = pubsDe(ids).filter((x) => (x.fecha_publicacion ?? "").slice(0, 10) <= p.hoy);
      return { valor: vencido.filter((x) => x.estado === "publicado").length, metaAuto: vencido.length };
    }
    case "piezas_diseno": {
      const ids = new Set(activos.filter((c) => c.disenador_id === persona).map((c) => c.id));
      return {
        valor: d.tareasCerradas.filter((t) => t.asignado_a_id === persona && t.area === "Diseño" && en(t.fecha_completada, p)).length,
        metaAuto: pubsDe(ids, (t) => DISENO.has(t)).length,
      };
    }
    case "piezas_edicion": {
      const ids = new Set(activos.filter((c) => c.audiovisual_id === persona).map((c) => c.id));
      return {
        valor: d.tareasCerradas.filter(
          (t) => t.asignado_a_id === persona && t.area === "Edición Audiovisual" && en(t.fecha_completada, p)
        ).length,
        metaAuto: pubsDe(ids, (t) => EDICION.has(t)).length,
      };
    }
    case "reuniones_mensuales": {
      const ids = new Set(activos.map((c) => c.id));
      const hechas = new Set(d.reunionesMensuales.filter((r) => ids.has(r.cliente_id) && en(r.fecha, p)).map((r) => r.cliente_id));
      return { valor: hechas.size, metaAuto: ids.size };
    }
    case "calendario_aprobado": {
      const ids = new Set(activos.map((c) => c.id));
      const plan = pubsDe(ids);
      return { valor: plan.filter((x) => x.estado !== "idea").length, metaAuto: plan.length };
    }
    default:
      return { valor: 0, metaAuto: null };
  }
}

/**
 * Avance de una métrica para una persona en un período.
 * `metaManual` es la que se cargó a mano (manda sobre la automática).
 */
export function avance(
  m: MetricaId,
  persona: string,
  d: DatosObjetivos,
  p: Periodo,
  metaManual: number | null
): Avance {
  if (m === "conversion_propuestas") {
    const env = contarMeta("propuestas_enviadas", persona, d, p).valor;
    const cer = contarMeta("cierres", persona, d, p).valor;
    return { valor: env > 0 ? Math.round((cer / env) * 100) : 0, meta: metaManual, proyeccion: null };
  }
  const { valor, metaAuto } = contarMeta(m, persona, d, p);
  const meta = metaManual ?? metaAuto;
  // Lo planificado ya trae el período entero: no se proyecta. Lo que se
  // produce de a poco (leads, reuniones) sí.
  const proyecta = METRICAS[m].metaManual && meta != null && p.transcurridos < p.dias;
  return {
    valor,
    meta,
    proyeccion: proyecta ? Math.round((valor / Math.max(1, p.transcurridos)) * p.dias) : null,
  };
}

/** Porcentaje cumplido (0-100+), o null si no hay meta. */
export function pctCumplido(a: Avance): number | null {
  if (a.meta == null || a.meta <= 0) return null;
  return Math.round((a.valor / a.meta) * 100);
}
