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
  | "calendario_aprobado"
  // Coordinación y dirección (21/10/2026, pedido del dueño: «objetivos clave a cada rol de coordinación, incluido el mío»).
  | "aprobacion_creativa"
  | "reuniones_mis_cuentas"
  | "satisfaccion"
  | "tareas_a_tiempo"
  | "cambios_de_fecha"
  | "piezas_al_dia"
  | "pauta_activa"
  | "cuentas_medidas"
  | "onboarding_pauta"
  | "cuentas_activas"
  | "bajas";

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
  /** Es una foto de HOY (no se acumula por día): sin desglose semana/día. */
  foto?: boolean;
  /** Cuanto menos, mejor (cambios de fecha, bajas): la meta es un techo. */
  menosEsMejor?: boolean;
  /** Meta fija cuando no se cargó otra (ej. 100% aprobado, 0 bajas). */
  metaFija?: number;
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
  aprobacion_creativa: {
    id: "aprobacion_creativa",
    label: "Piezas que pasaron por tu aprobación",
    ayuda: "Tareas de diseño y edición cerradas en el período que antes pasaron por revisión (aprobación de la dirección creativa).",
    unidad: "%",
    metaManual: false,
    soloMes: true,
    metaFija: 100,
  },
  reuniones_mis_cuentas: {
    id: "reuniones_mis_cuentas",
    label: "Reuniones mensuales de tus cuentas",
    ayuda: "Cuentas a tu cargo con la reunión del mes hecha.",
    unidad: "n",
    metaManual: false,
    soloMes: true,
  },
  satisfaccion: {
    id: "satisfaccion",
    label: "Clientes satisfechos",
    ayuda: "Encuestas del portal con 4 o 5 puntos, sobre las respondidas en el mes.",
    unidad: "%",
    metaManual: false,
    soloMes: true,
    metaFija: 90,
  },
  tareas_a_tiempo: {
    id: "tareas_a_tiempo",
    label: "Tareas cerradas a tiempo",
    ayuda: "Del equipo: tareas cerradas en su fecha o antes, sobre las cerradas en el período.",
    unidad: "%",
    metaManual: false,
    metaFija: 90,
  },
  cambios_de_fecha: {
    id: "cambios_de_fecha",
    label: "Cambios de fecha",
    ayuda: "Veces que alguien del equipo movió la fecha límite de una tarea. Cuantas menos, mejor.",
    unidad: "n",
    metaManual: true,
    menosEsMejor: true,
  },
  piezas_al_dia: {
    id: "piezas_al_dia",
    label: "Piezas publicadas en fecha",
    ayuda: "De toda la agencia: lo publicado contra lo que ya tenía que salir.",
    unidad: "n",
    metaManual: false,
  },
  pauta_activa: {
    id: "pauta_activa",
    label: "Cuentas con pauta corriendo",
    ayuda: "Cuentas con publicidad contratada que gastaron algo en los últimos 3 días.",
    unidad: "n",
    metaManual: false,
    foto: true,
  },
  cuentas_medidas: {
    id: "cuentas_medidas",
    label: "Cuentas vinculadas y medidas",
    ayuda: "Cuentas activas cuyo Instagram trae datos a la plataforma.",
    unidad: "n",
    metaManual: false,
    foto: true,
  },
  onboarding_pauta: {
    id: "onboarding_pauta",
    label: "Onboardings de pauta completos",
    ayuda: "Cuentas con publicidad contratada que ya tienen sus campañas publicadas.",
    unidad: "n",
    metaManual: false,
    foto: true,
  },
  cuentas_activas: {
    id: "cuentas_activas",
    label: "Cuentas activas",
    ayuda: "Clientes activos hoy. El objetivo de fin de año es 18.",
    unidad: "n",
    metaManual: true,
    foto: true,
    metaFija: 18,
  },
  bajas: {
    id: "bajas",
    label: "Bajas",
    ayuda: "Clientes que se fueron en el período. El objetivo es cero.",
    unidad: "n",
    metaManual: false,
    soloMes: true,
    menosEsMejor: true,
    metaFija: 0,
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
  if (areas.includes("Coordinación de Diseño")) out.push("calendario_aprobado", "aprobacion_creativa", "reuniones_mis_cuentas", "satisfaccion");
  if (areas.includes("Coordinación")) out.push("reuniones_mensuales", "tareas_a_tiempo", "cambios_de_fecha", "piezas_al_dia");
  if (areas.includes("Coordinación de Paid Media")) out.push("pauta_activa", "onboarding_pauta", "cuentas_medidas");
  if (areas.includes("Estrategia/Dirección")) out.push("cuentas_activas", "bajas", "satisfaccion", "tareas_a_tiempo");
  if (roles.includes("community_manager")) out.push("piezas_publicadas");
  if (roles.includes("diseno")) out.push("piezas_diseno");
  if (roles.includes("audiovisual")) out.push("piezas_edicion");
  return [...new Set(out)];
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
    responsable_id?: string | null;
    fecha_inactivado?: string | null;
    media_buyer_id?: string | null;
  }[];
  publicaciones: {
    cliente_id: string;
    tipo: string;
    estado: string;
    fecha_publicacion: string | null;
    revision_creativa_at?: string | null;
  }[];
  tareasCerradas: {
    id?: string;
    asignado_a_id: string | null;
    area: string | null;
    fecha_completada: string | null;
    fecha_limite?: string | null;
  }[];
  reunionesMensuales: { cliente_id: string; fecha: string }[];
  // ── Coordinación y dirección (21/10/2026). Opcionales: la pantalla vieja no los carga. ──
  /** Cambios de fecha límite hechos por una persona (task_history). */
  cambiosFecha?: { fecha: string }[];
  /** Encuestas del portal. */
  encuestas?: { puntaje: number; fecha: string }[];
  /** Servicios activos de cada cuenta. */
  servicios?: { cliente_id: string; tipo: string }[];
  /** Cuentas cuyo Instagram trajo datos en los últimos días. */
  medidas?: string[];
  /** Cuentas con gasto de pauta en los últimos días. */
  conPauta?: string[];
  /** Cuentas con las campañas publicadas en el onboarding de pauta. */
  pautaLista?: string[];
  /** Tareas que pasaron por «en revisión» (la aprobación de la dirección creativa). */
  revisadas?: string[];
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
    case "aprobacion_creativa": {
      // La aprobación vive en las tareas: diseño y edición pasan a «en revisión» y la dirección creativa aprueba.
      const revisadas = new Set(d.revisadas ?? []);
      const cerradas = d.tareasCerradas.filter(
        (t) => (t.area === "Diseño" || t.area === "Edición Audiovisual") && en(t.fecha_completada, p)
      );
      if (!cerradas.length) return { valor: 0, metaAuto: 100 };
      const pasaron = cerradas.filter((t) => t.id && revisadas.has(t.id)).length;
      return { valor: Math.round((pasaron / cerradas.length) * 100), metaAuto: 100 };
    }
    case "reuniones_mis_cuentas": {
      const ids = new Set(activos.filter((c) => c.responsable_id === persona).map((c) => c.id));
      const hechas = new Set(d.reunionesMensuales.filter((r) => ids.has(r.cliente_id) && en(r.fecha, p)).map((r) => r.cliente_id));
      return { valor: hechas.size, metaAuto: ids.size };
    }
    case "satisfaccion": {
      const del = (d.encuestas ?? []).filter((e) => en(e.fecha, p));
      // Sin encuestas respondidas no hay nada que medir (ni rojo ni verde).
      if (!del.length) return { valor: 0, metaAuto: null };
      return { valor: Math.round((del.filter((e) => e.puntaje >= 4).length / del.length) * 100), metaAuto: 90 };
    }
    case "tareas_a_tiempo": {
      const cerradas = d.tareasCerradas.filter((t) => en(t.fecha_completada, p) && t.fecha_limite);
      if (!cerradas.length) return { valor: 0, metaAuto: 90 };
      const aTiempo = cerradas.filter((t) => (t.fecha_completada ?? "").slice(0, 10) <= (t.fecha_limite ?? "").slice(0, 10)).length;
      return { valor: Math.round((aTiempo / cerradas.length) * 100), metaAuto: 90 };
    }
    case "cambios_de_fecha":
      return { valor: (d.cambiosFecha ?? []).filter((c) => en(c.fecha, p)).length, metaAuto: null };
    case "piezas_al_dia": {
      const ids = new Set(activos.map((c) => c.id));
      const vencido = pubsDe(ids).filter((x) => (x.fecha_publicacion ?? "").slice(0, 10) <= p.hoy);
      return { valor: vencido.filter((x) => x.estado === "publicado").length, metaAuto: vencido.length };
    }
    case "pauta_activa":
    case "onboarding_pauta": {
      // Tiene pauta la cuenta con media buyer asignado (la pauta viene en los packs) o con el servicio aparte.
      const activosIds = new Set(activos.map((c) => c.id));
      const conPaid = new Set([
        ...activos.filter((c) => c.media_buyer_id).map((c) => c.id),
        ...(d.servicios ?? []).filter((x) => x.tipo === "paid_media" && activosIds.has(x.cliente_id)).map((x) => x.cliente_id),
      ]);
      const lista = new Set(m === "pauta_activa" ? d.conPauta ?? [] : d.pautaLista ?? []);
      return { valor: [...conPaid].filter((id) => lista.has(id)).length, metaAuto: conPaid.size };
    }
    case "cuentas_medidas": {
      const medidas = new Set(d.medidas ?? []);
      return { valor: activos.filter((c) => medidas.has(c.id)).length, metaAuto: activos.length };
    }
    case "cuentas_activas":
      return { valor: activos.length, metaAuto: 18 };
    case "bajas":
      return { valor: d.clientes.filter((c) => c.estado === "perdido" && !c.es_interno && en(c.fecha_inactivado, p)).length, metaAuto: 0 };
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

/* ---------------- «Tus objetivos» en Mi día (21/10/2026) ---------------- */

/** Hoy como período de un día (para el objetivo diario). */
export function diaDe(hoy: string): Periodo {
  const manana = ymd(utc(hoy) + 86_400_000);
  const d = new Date(utc(hoy)).getUTCDay();
  const habil = d !== 0 && d !== 6 ? 1 : 0;
  return { desde: hoy, hasta: manana, dias: habil, transcurridos: habil, hoy };
}

export interface FilaObjetivo {
  id: MetricaId;
  label: string;
  ayuda: string;
  unidad: "n" | "%";
  menosEsMejor: boolean;
  /** Foto de hoy: no tiene desglose por semana ni día. */
  foto: boolean;
  mes: Avance;
  semana: Avance | null;
  hoy: Avance | null;
}

/**
 * Los objetivos de una persona, del mes bajados a la semana y al día. La meta
 * mensual cargada a mano se reparte por días hábiles: el comercial con 1.320
 * por mes ve «60 hoy» y «300 esta semana».
 */
export function objetivosDePersona(
  persona: PersonaObj,
  d: DatosObjetivos,
  metas: Map<string, { semanal: number | null; mensual: number | null }>,
  hoy: string
): FilaObjetivo[] {
  const mes = mesDe(hoy);
  const semana = semanaDe(hoy);
  const dia = diaDe(hoy);
  return metricasDe(persona).map((id) => {
    const def = METRICAS[id];
    const guardada = metas.get(`${persona.id}:${id}`) ?? { semanal: null, mensual: null };
    const mensual = guardada.mensual ?? def.metaFija ?? null;
    const reparte = def.metaManual && def.unidad === "n" && mensual != null && !def.foto;
    const semanal = reparte ? guardada.semanal ?? Math.round((mensual! * semana.dias) / Math.max(1, mes.dias)) : null;
    const diaria = reparte ? Math.ceil(mensual! / Math.max(1, mes.dias)) : null;
    const conDesglose = !def.foto && !def.soloMes;
    // Metas chicas no se bajan al día («1 cierre por día» no tiene sentido): el día
    // solo si da al menos 1 por día hábil, la semana solo si da al menos 1 por semana.
    const verDia = !reparte || mensual! >= mes.dias;
    const verSemana = !reparte || mensual! >= 4;
    return {
      id,
      label: def.label,
      ayuda: def.ayuda,
      unidad: def.unidad,
      menosEsMejor: !!def.menosEsMejor,
      foto: !!def.foto,
      mes: avance(id, persona.id, d, mes, mensual),
      semana: conDesglose && verSemana ? avance(id, persona.id, d, semana, semanal) : null,
      hoy: conDesglose && verDia && dia.dias > 0 ? avance(id, persona.id, d, dia, diaria) : null,
    };
  });
}

/** ¿Va bien? Para pintar: verde, amarillo o rojo (null si no hay meta). */
export function semaforoObjetivo(a: Avance, menosEsMejor: boolean, p?: Periodo): "bien" | "regular" | "mal" | null {
  if (a.meta == null) return null;
  if (menosEsMejor) {
    // La meta es un techo: proporcional a lo que va del período.
    const techo = p ? (a.meta * p.transcurridos) / Math.max(1, p.dias) : a.meta;
    if (a.valor <= techo) return "bien";
    return a.valor <= a.meta ? "regular" : "mal";
  }
  if (a.meta <= 0) return "bien";
  // A mitad de período se mira a qué ritmo viene (la proyección), no lo que ya juntó.
  const ratio = (a.proyeccion ?? a.valor) / a.meta;
  return ratio >= 0.9 ? "bien" : ratio >= 0.6 ? "regular" : "mal";
}
