/**
 * "Máquina de clientes" — el cálculo del tablero de KPIs comerciales.
 *
 * Todo el módulo es PURO (entra data cruda, sale el tablero) para poder testear
 * los números sin base de datos. La página `/objetivos/maquina` solo trae las
 * filas y las pinta.
 *
 * El modelo de negocio que estamos midiendo (reunión con Leo, julio 2026):
 *   contactos fríos → % que agenda reunión → % de reuniones que cierran
 * Con meta de 50 clientes fijos antes de fin de año.
 */

/** Meta de clientes fijos y fecha límite. Se cambian acá si el norte cambia. */
export const META_CLIENTES = 50;
export const META_DEADLINE = "2026-12-31";

/** Referencia del modelo charlado con Leo, para contrastar contra lo real. */
export const MODELO = {
  /** % de contactados que agenda una reunión. */
  agendaPct: 2.5,
  /** % de reuniones que terminan en cliente. */
  cierrePct: 25,
} as const;

export interface ClienteRow {
  id: string;
  nombre: string;
  estado: string;
  monto_mensual: number | null;
  /** Fecha en que arrancó el servicio (la buena). */
  fecha_inicio: string | null;
  /** Cuándo se activó en la app (respaldo si no hay fecha_inicio). */
  fecha_activado: string | null;
  fecha_inactivado: string | null;
  es_interno: boolean | null;
  cerrado_por_id: string | null;
  created_at: string | null;
}

export interface ContactoRow {
  id: string;
  estado: string;
  contactable: boolean | null;
  created_at: string;
  contactado_at: string | null;
  reunion_at: string | null;
  asignado_a: string | null;
}

export interface MachineInput {
  clientes: ClienteRow[];
  contactos: ContactoRow[];
  /** id → nombre, para la tabla por persona. */
  usuarios: { id: string; nombre: string }[];
  /** Gasto de IA de prospección del mes en curso (USD). */
  costoIaMesUsd: number;
  /** Ahora (inyectable para testear). */
  ahora: Date;
}

export interface SemanaRow {
  /** Lunes de la semana, ISO (yyyy-mm-dd). */
  inicio: string;
  cargados: number;
  contactados: number;
  reuniones: number;
  altas: number;
  bajas: number;
  neto: number;
}

export interface PersonaRow {
  id: string;
  nombre: string;
  contactados7: number;
  contactados30: number;
  reuniones30: number;
  cierresTotales: number;
}

export type Semaforo = "verde" | "amarillo" | "rojo";

export interface MachineKpis {
  meta: {
    objetivo: number;
    activos: number;
    faltan: number;
    semanasRestantes: number;
    /** Altas NETAS por semana necesarias para llegar. */
    ritmoNecesario: number;
    /** Altas netas por semana de las últimas 8 semanas. */
    ritmoActual: number;
    /** Clientes proyectados al deadline si se sostiene el ritmo actual. */
    proyeccion: number;
    semaforo: Semaforo;
  };
  embudo: {
    dias: number;
    cargados: number;
    contactados: number;
    /** Contactados a los que sí se los pudo alcanzar (dato bueno). */
    alcanzados: number;
    reuniones: number;
    cierres: number;
    /** % de alcanzados que agendó. null si no hay base. */
    agendaPct: number | null;
    /** % de reuniones que cerró. null si no hay base. */
    cierrePct: number | null;
    /** Contactos que hay que tocar para sacar un cliente, al ritmo actual. */
    contactosPorCliente: number | null;
  };
  semanas: SemanaRow[];
  personas: PersonaRow[];
  retencion: {
    activos: number;
    perdidos: number;
    bajas90: number;
    /** % del padrón que se va por mes (promedio de los últimos 90 días). */
    churnMensualPct: number | null;
    /** Meses que dura una cuenta promedio al churn actual. */
    vidaMediaMeses: number | null;
    /** Altas menos bajas de los últimos 90 días. */
    neto90: number;
  };
  plata: {
    mrr: number;
    ticketPromedio: number;
    /** MRR que habría a 50 clientes con el ticket de hoy. */
    mrrObjetivo: number;
    mrrNuevo30: number;
    mrrPerdido30: number;
    costoIaMesUsd: number;
    /** USD de IA por cliente cerrado en los últimos 30 días. */
    costoIaPorCierre: number | null;
  };
  /** Problemas de datos que hacen mentir al tablero. */
  avisos: string[];
}

const DIA = 86_400_000;

/** Lunes (ISO) de la semana de una fecha, en yyyy-mm-dd. */
export function lunesDe(d: Date): string {
  const on = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (on.getUTCDay() + 6) % 7; // lunes = 0
  on.setUTCDate(on.getUTCDate() - dow);
  return on.toISOString().slice(0, 10);
}

/** Fecha de alta de una cuenta: la del servicio, con respaldo en la activación. */
export function fechaAlta(c: ClienteRow): string | null {
  return c.fecha_inicio ?? (c.fecha_activado ? c.fecha_activado.slice(0, 10) : null);
}

const enRango = (iso: string | null | undefined, desde: Date, hasta: Date): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= desde.getTime() && t <= hasta.getTime();
};

const pct = (parte: number, total: number): number | null =>
  total > 0 ? Math.round((parte / total) * 1000) / 10 : null;

export function computeMachineKpis(input: MachineInput): MachineKpis {
  const { clientes, contactos, usuarios, costoIaMesUsd, ahora } = input;

  const externos = clientes.filter((c) => !c.es_interno);
  const activos = externos.filter((c) => c.estado === "activo");
  const perdidos = externos.filter((c) => c.estado === "perdido");

  // ── Meta ──────────────────────────────────────────────────────────────────
  const deadline = new Date(`${META_DEADLINE}T23:59:59Z`);
  const semanasRestantes = Math.max(
    0,
    Math.round(((deadline.getTime() - ahora.getTime()) / (7 * DIA)) * 10) / 10
  );
  const faltan = Math.max(0, META_CLIENTES - activos.length);
  const ritmoNecesario =
    semanasRestantes > 0 ? Math.round((faltan / semanasRestantes) * 100) / 100 : faltan;

  // Ritmo real: altas netas (altas - bajas) de las últimas 8 semanas.
  const hace8sem = new Date(ahora.getTime() - 56 * DIA);
  const altas8 = externos.filter((c) => enRango(fechaAlta(c), hace8sem, ahora)).length;
  const bajas8 = externos.filter((c) => enRango(c.fecha_inactivado, hace8sem, ahora)).length;
  const ritmoActual = Math.round(((altas8 - bajas8) / 8) * 100) / 100;
  const proyeccion = Math.round(activos.length + ritmoActual * semanasRestantes);
  const semaforo: Semaforo =
    ritmoActual >= ritmoNecesario ? "verde" : ritmoActual >= ritmoNecesario * 0.6 ? "amarillo" : "rojo";

  // ── Embudo (últimos 30 días) ──────────────────────────────────────────────
  const hace30 = new Date(ahora.getTime() - 30 * DIA);
  const hace7 = new Date(ahora.getTime() - 7 * DIA);
  const hace90 = new Date(ahora.getTime() - 90 * DIA);

  const cargados = contactos.filter((c) => enRango(c.created_at, hace30, ahora)).length;
  const contactados30 = contactos.filter((c) => enRango(c.contactado_at, hace30, ahora));
  const noSePudo30 = contactados30.filter((c) => c.contactable === false).length;
  const alcanzados = contactados30.length - noSePudo30;
  const reuniones30 = contactos.filter((c) => enRango(c.reunion_at, hace30, ahora)).length;
  const cierres30 = externos.filter((c) => enRango(fechaAlta(c), hace30, ahora)).length;

  const embudo: MachineKpis["embudo"] = {
    dias: 30,
    cargados,
    contactados: contactados30.length,
    alcanzados,
    reuniones: reuniones30,
    cierres: cierres30,
    agendaPct: pct(reuniones30, alcanzados),
    cierrePct: pct(cierres30, reuniones30),
    contactosPorCliente: cierres30 > 0 ? Math.round(contactados30.length / cierres30) : null,
  };

  // ── Ritmo semanal (8 semanas, la más nueva primero) ───────────────────────
  const semanasMap = new Map<string, SemanaRow>();
  for (let i = 0; i < 8; i++) {
    const d = new Date(ahora.getTime() - i * 7 * DIA);
    const k = lunesDe(d);
    semanasMap.set(k, { inicio: k, cargados: 0, contactados: 0, reuniones: 0, altas: 0, bajas: 0, neto: 0 });
  }
  const sumar = (iso: string | null | undefined, campo: keyof Omit<SemanaRow, "inicio">) => {
    if (!iso) return;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return;
    const row = semanasMap.get(lunesDe(t));
    if (row) row[campo] += 1;
  };
  for (const c of contactos) {
    sumar(c.created_at, "cargados");
    sumar(c.contactado_at, "contactados");
    sumar(c.reunion_at, "reuniones");
  }
  for (const c of externos) {
    sumar(fechaAlta(c), "altas");
    sumar(c.fecha_inactivado, "bajas");
  }
  const semanas = [...semanasMap.values()]
    .map((s) => ({ ...s, neto: s.altas - s.bajas }))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));

  // ── Por persona ───────────────────────────────────────────────────────────
  const nombreDe = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const idsConMovimiento = new Set<string>();
  for (const c of contactos) if (c.asignado_a) idsConMovimiento.add(c.asignado_a);
  for (const c of externos) if (c.cerrado_por_id) idsConMovimiento.add(c.cerrado_por_id);

  const personas: PersonaRow[] = [...idsConMovimiento]
    .map((id) => ({
      id,
      nombre: nombreDe.get(id) ?? "—",
      contactados7: contactos.filter((c) => c.asignado_a === id && enRango(c.contactado_at, hace7, ahora)).length,
      contactados30: contactos.filter((c) => c.asignado_a === id && enRango(c.contactado_at, hace30, ahora)).length,
      reuniones30: contactos.filter((c) => c.asignado_a === id && enRango(c.reunion_at, hace30, ahora)).length,
      cierresTotales: externos.filter((c) => c.cerrado_por_id === id).length,
    }))
    .sort((a, b) => b.contactados30 - a.contactados30 || b.cierresTotales - a.cierresTotales);

  // ── Retención ─────────────────────────────────────────────────────────────
  const bajas90 = externos.filter((c) => enRango(c.fecha_inactivado, hace90, ahora)).length;
  const altas90 = externos.filter((c) => enRango(fechaAlta(c), hace90, ahora)).length;
  const baseChurn = activos.length + bajas90;
  const churnMensualPct = baseChurn > 0 ? Math.round((bajas90 / 3 / baseChurn) * 1000) / 10 : null;
  const vidaMediaMeses =
    churnMensualPct && churnMensualPct > 0 ? Math.round((100 / churnMensualPct) * 10) / 10 : null;

  // ── Plata ─────────────────────────────────────────────────────────────────
  const mrr = activos.reduce((s, c) => s + (c.monto_mensual ?? 0), 0);
  const conMonto = activos.filter((c) => (c.monto_mensual ?? 0) > 0);
  const ticketPromedio = conMonto.length > 0 ? Math.round(mrr / conMonto.length) : 0;
  const mrrNuevo30 = externos
    .filter((c) => enRango(fechaAlta(c), hace30, ahora))
    .reduce((s, c) => s + (c.monto_mensual ?? 0), 0);
  const mrrPerdido30 = externos
    .filter((c) => enRango(c.fecha_inactivado, hace30, ahora))
    .reduce((s, c) => s + (c.monto_mensual ?? 0), 0);

  // ── Avisos de datos ───────────────────────────────────────────────────────
  const avisos: string[] = [];
  const sinDuenio = contactos.filter((c) => !c.asignado_a && c.estado !== "nuevo").length;
  if (sinDuenio > 0)
    avisos.push(
      `${sinDuenio} contactos ya trabajados están sin dueño: no se puede saber quién los movió. Al marcarles el estado quedan auto-asignados.`
    );
  const sinMonto = activos.filter((c) => !c.monto_mensual).length;
  if (sinMonto > 0)
    avisos.push(`${sinMonto} cuenta(s) activa(s) sin monto mensual: no suman al MRR ni al ticket promedio.`);
  const sinFechaAlta = externos.filter((c) => !fechaAlta(c)).length;
  if (sinFechaAlta > 0)
    avisos.push(`${sinFechaAlta} cuenta(s) sin fecha de inicio: no entran en el ritmo de altas.`);
  // Varias bajas con la MISMA fecha son casi siempre la carga inicial de datos
  // (se dieron de baja todas juntas al migrar), no clientes que se fueron ese
  // día. Inflan el churn y la vida media, así que hay que avisarlo.
  const porDiaBaja = new Map<string, number>();
  for (const c of externos) {
    if (!c.fecha_inactivado) continue;
    const d = c.fecha_inactivado.slice(0, 10);
    porDiaBaja.set(d, (porDiaBaja.get(d) ?? 0) + 1);
  }
  const diasMasivos = [...porDiaBaja.entries()].filter(([, n]) => n >= 3);
  if (diasMasivos.length > 0) {
    const total = diasMasivos.reduce((s, [, n]) => s + n, 0);
    avisos.push(
      `${total} bajas están cargadas todas el mismo día (${diasMasivos
        .map(([d]) => d)
        .join(", ")}): parece la carga inicial de datos, no clientes que se fueron ahí. Mientras estén así, el churn y la vida media se leen peor de lo que son.`
    );
  }

  const sinCerrador = activos.filter((c) => !c.cerrado_por_id).length;
  if (sinCerrador > 0)
    avisos.push(
      `${sinCerrador} cuenta(s) activa(s) sin "cerrado por": la columna de cierres por persona queda incompleta.`
    );
  if (reuniones30 === 0 && contactados30.length > 0)
    avisos.push(
      'Ninguna reunión agendada en 30 días. Si hubo, marcá el contacto como "Reunión agendada" — es el número que define si la máquina funciona.'
    );

  return {
    meta: {
      objetivo: META_CLIENTES,
      activos: activos.length,
      faltan,
      semanasRestantes,
      ritmoNecesario,
      ritmoActual,
      proyeccion,
      semaforo,
    },
    embudo,
    semanas,
    personas,
    retencion: {
      activos: activos.length,
      perdidos: perdidos.length,
      bajas90,
      churnMensualPct,
      vidaMediaMeses,
      neto90: altas90 - bajas90,
    },
    plata: {
      mrr,
      ticketPromedio,
      mrrObjetivo: ticketPromedio * META_CLIENTES,
      mrrNuevo30,
      mrrPerdido30,
      costoIaMesUsd,
      costoIaPorCierre:
        cierres30 > 0 ? Math.round((costoIaMesUsd / cierres30) * 100) / 100 : null,
    },
    avisos,
  };
}
