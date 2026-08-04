/**
 * ¿Quién está prospectando de verdad y cuánto?
 *
 * Por qué existe: la app tenía 132 contactos cargados y **1 solo contactado en
 * los últimos 7 días**. El canal no fallaba, no se usaba. Y no había forma de
 * ver eso: los contactos estaban ahí, mudos, sin nadie mirando si alguien les
 * escribía. Sin medición no hay hábito.
 *
 * Todo lo de acá es puro (entra data, sale el resumen) para poder testearlo y
 * para que lo usen igual la pantalla y el aviso diario.
 */

/** Cuántos mensajes por día se espera de cada persona que prospecta. */
export const META_DIARIA = 15;

/** A partir de cuántos días sin escribir se considera que alguien se colgó. */
export const DIAS_INACTIVO = 3;

export interface ContactoActividad {
  asignado_a: string | null;
  contactado_at: string | null;
  estado: string | null;
  reunion_at?: string | null;
}

export interface PersonaProspecta {
  id: string;
  nombre: string;
}

export interface FilaActividad {
  id: string;
  nombre: string;
  hoy: number;
  semana: number;
  mes: number;
  interesados: number;
  reuniones: number;
  /** Último día que escribió, "YYYY-MM-DD", o null si nunca. */
  ultimoDia: string | null;
  /** Días sin escribirle a nadie. null = nunca escribió. */
  diasSinEscribir: number | null;
  cumpleHoy: boolean;
}

export interface ResumenActividad {
  filas: FilaActividad[];
  totalHoy: number;
  totalSemana: number;
  metaEquipoHoy: number;
  /** Nadie escribió todavía hoy: es el aviso que importa. */
  nadieEscribioHoy: boolean;
  /** Los que hace DIAS_INACTIVO o más que no escriben (o nunca escribieron). */
  colgados: FilaActividad[];
}

/** Días entre dos fechas "YYYY-MM-DD", leyendo los dígitos (no `new Date`). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** El lunes de la semana de `ymd`, como "YYYY-MM-DD". */
export function lunesDe(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

export function resumirActividad(
  contactos: ContactoActividad[],
  personas: PersonaProspecta[],
  hoy: string
): ResumenActividad {
  const lunes = lunesDe(hoy);
  const mes = hoy.slice(0, 7);

  const filas: FilaActividad[] = personas.map((p) => {
    const mios = contactos.filter((c) => c.asignado_a === p.id && c.contactado_at);
    const dias = mios.map((c) => c.contactado_at!.slice(0, 10));
    const ultimoDia = dias.length ? dias.sort().at(-1)! : null;
    return {
      id: p.id,
      nombre: p.nombre,
      hoy: dias.filter((d) => d === hoy).length,
      semana: dias.filter((d) => d >= lunes && d <= hoy).length,
      mes: dias.filter((d) => d.startsWith(mes)).length,
      interesados: mios.filter((c) => c.estado === "interesado").length,
      reuniones: mios.filter((c) => c.estado === "reunion" || c.reunion_at).length,
      ultimoDia,
      diasSinEscribir: ultimoDia ? diasEntre(ultimoDia, hoy) : null,
      cumpleHoy: dias.filter((d) => d === hoy).length >= META_DIARIA,
    };
  });

  filas.sort((a, b) => b.semana - a.semana || b.mes - a.mes);

  const totalHoy = filas.reduce((a, f) => a + f.hoy, 0);
  return {
    filas,
    totalHoy,
    totalSemana: filas.reduce((a, f) => a + f.semana, 0),
    metaEquipoHoy: personas.length * META_DIARIA,
    nadieEscribioHoy: totalHoy === 0,
    colgados: filas.filter(
      (f) => f.diasSinEscribir === null || f.diasSinEscribir >= DIAS_INACTIVO
    ),
  };
}

/**
 * El texto del aviso diario de cada persona. Corto y con el número adelante:
 * es una notificación en la campana, no un informe.
 */
export function avisoPersonal(f: FilaActividad): string {
  if (f.hoy >= META_DIARIA)
    return `✅ Prospección: ${f.hoy} mensajes hoy. Meta cumplida.`;
  if (f.hoy > 0)
    return `Prospección: ${f.hoy} de ${META_DIARIA} mensajes hoy. Te faltan ${META_DIARIA - f.hoy}.`;
  if (f.diasSinEscribir === null)
    return `Prospección: todavía no escribiste a ningún contacto. La meta es ${META_DIARIA} por día.`;
  return `Prospección: 0 mensajes hoy (hace ${f.diasSinEscribir} ${f.diasSinEscribir === 1 ? "día" : "días"} que no escribís). Meta: ${META_DIARIA}.`;
}

/** El resumen que ve el dueño: quién cumplió y quién no. */
export function avisoParaElDueno(r: ResumenActividad): string {
  if (r.nadieEscribioHoy)
    return `⚠️ Prospección: HOY no escribió nadie. Meta del equipo: ${r.metaEquipoHoy} mensajes.`;
  const cumplieron = r.filas.filter((f) => f.cumpleHoy).length;
  const detalle = r.filas
    .filter((f) => f.hoy > 0)
    .map((f) => `${f.nombre.split(" ")[0]} ${f.hoy}`)
    .join(", ");
  return `Prospección de hoy: ${r.totalHoy} de ${r.metaEquipoHoy} · ${cumplieron} cumplieron la meta · ${detalle}`;
}
