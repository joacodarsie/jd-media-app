/**
 * El tablero de la Project Manager (20/10/2026, pedido del dueño): lo que era
 * «Cuentas nuevas», pensado para que Luz entre y sepa qué hacer hoy con cada
 * cuenta, sin tareas atrasadas que nadie mira.
 *
 * Tres cambios de fondo:
 *  - Los hitos de control del arranque («Día 7: ¿llegó el material?», «¿Hace
 *    falta jornada de producción?») no son tareas: son preguntas. Se contestan
 *    Sí o No y la respuesta decide qué pasa (cerrar, pausar esperando al
 *    cliente, armar la jornada).
 *  - Lo atrasado se ve paso por paso, con quién lo tiene, para avisarle o
 *    pausarlo si lo frena el cliente.
 *  - Solo entran las cuentas con gestión de redes (un proyecto de marca como
 *    Simple Snack no se maneja desde acá).
 *
 * Módulo PURO.
 */
import type { ArranqueEnCurso, PasoDelArranque } from "@/lib/retencion/onboarding-panorama";
import type { CuentaNueva, Estado } from "@/lib/retencion/cuentas-nuevas";

export type TipoPregunta = "material" | "jornada" | "general";

export const esPregunta = (titulo: string): boolean => /¿[^?]+\?/.test(titulo);

export function tipoPregunta(titulo: string): TipoPregunta {
  const t = titulo.toLowerCase();
  if (/jornada/.test(t)) return "jornada";
  if (/material|contenido/.test(t)) return "material";
  return "general";
}

/** «Día 7: ¿llegó el material?» → «¿Llegó el material?» */
export function textoPregunta(titulo: string): string {
  const m = titulo.match(/¿([^?]+)\?/);
  if (!m) return titulo;
  return `¿${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}?`;
}

export interface PasoPm {
  id: string;
  numero: number | null;
  titulo: string;
  responsable: string | null;
  responsableId: string | null;
  vence: string | null; // "YYYY-MM-DD"
  dia: number;
  detallePausa: string | null;
}

export interface PreguntaPm extends PasoPm {
  pregunta: string;
  tipo: TipoPregunta;
}

export interface CuentaPm {
  id: string;
  nombre: string;
  dia: number;
  mes: number;
  estado: Estado;
  chequeos: CuentaNueva["chequeos"];
  arranque: { hechos: number; total: number; terminado: boolean; diaActual: number } | null;
  preguntas: PreguntaPm[];
  atrasados: PasoPm[];
  pausados: PasoPm[];
  proximos: PasoPm[];
  /** Lo que la PM tiene para hacer hoy en esta cuenta. */
  pendientesHoy: number;
}

const aPaso = (p: PasoDelArranque): PasoPm => ({
  id: p.id,
  numero: p.numero,
  titulo: p.titulo,
  responsable: p.asignado_nombre,
  responsableId: p.asignado_a_id ?? null,
  vence: p.fecha_limite ? p.fecha_limite.slice(0, 10) : null,
  dia: p.dia,
  detallePausa: p.bloqueo === "cliente" ? p.bloqueo_detalle ?? null : null,
});

export function cuentaParaPm(c: CuentaNueva, a: ArranqueEnCurso | null, hoy: string): CuentaPm {
  const abiertos = (a?.pasos ?? []).filter((p) => !p.hecho);
  const pausados = abiertos.filter((p) => p.bloqueo === "cliente");
  const sinPausa = abiertos.filter((p) => p.bloqueo !== "cliente");
  // Una pregunta se contesta cuando le llega el día (o si ya pasó).
  const preguntas = sinPausa
    .filter((p) => esPregunta(p.titulo) && (!p.fecha_limite || p.fecha_limite.slice(0, 10) <= hoy))
    .map((p) => ({ ...aPaso(p), pregunta: textoPregunta(p.titulo), tipo: tipoPregunta(p.titulo) }));
  const atrasados = sinPausa.filter((p) => !esPregunta(p.titulo) && p.atrasado).map(aPaso);
  const enCurso = new Set([...preguntas, ...atrasados].map((p) => p.id));
  const proximos = sinPausa
    .filter((p) => !enCurso.has(p.id) && !esPregunta(p.titulo))
    .sort((x, y) => (x.fecha_limite ?? "9999").localeCompare(y.fecha_limite ?? "9999"))
    .slice(0, 3)
    .map(aPaso);
  return {
    id: c.id,
    nombre: c.nombre,
    dia: c.dia,
    mes: c.mes,
    estado: c.estado,
    chequeos: c.chequeos.filter((x) => x.clave !== "arranque"),
    arranque: a ? { hechos: a.hechos, total: a.total, terminado: a.terminado, diaActual: a.diaActual } : null,
    preguntas,
    atrasados,
    pausados: pausados.map(aPaso),
    proximos,
    pendientesHoy: preguntas.length + atrasados.length,
  };
}

const PESO: Record<Estado, number> = { ok: 0, atento: 1, mal: 2 };

/** Primero las cuentas con algo para hacer hoy, después las en riesgo. */
export function ordenarPm(cuentas: CuentaPm[]): CuentaPm[] {
  return [...cuentas].sort((a, b) => b.pendientesHoy - a.pendientesHoy || PESO[b.estado] - PESO[a.estado] || a.dia - b.dia);
}

export function resumenPm(cuentas: CuentaPm[]) {
  return {
    cuentas: cuentas.length,
    preguntas: cuentas.reduce((n, c) => n + c.preguntas.length, 0),
    atrasados: cuentas.reduce((n, c) => n + c.atrasados.length, 0),
    pausados: cuentas.reduce((n, c) => n + c.pausados.length, 0),
    enRiesgo: cuentas.filter((c) => c.estado === "mal").length,
  };
}
