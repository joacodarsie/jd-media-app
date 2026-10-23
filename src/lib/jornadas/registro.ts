/**
 * El registro de las jornadas de producción (23/10/2026). Pedido del dueño: se
 * agendaban, pero se colgaba con los cobros y los pagos. Cada jornada tiene que
 * decir cuánto vale, cuánto se cobró, cuánto se le debe a cada uno y qué falta.
 *
 * El circuito: se agenda (Agenda) → pasa la jornada → Luz confirma los datos
 * reales (duración y viáticos de cada uno) → el dueño cobra y paga, y lo marca.
 *
 * Puro: entra la jornada, sale el reparto por persona y en qué está.
 */
import { splitJornada } from "@/lib/jornada";

export interface Pago {
  monto: number;
  fecha: string;
}

export interface JornadaRegistro {
  id: string;
  fecha: string;
  /** "HH:MM" */
  horaInicio: string | null;
  horas: number;
  /** Precio del trabajo (sin viáticos): sale de las horas. */
  monto: number;
  /** Total de viáticos (la suma del detalle). */
  viaticos: number;
  /** Viáticos de cada persona. Vacío en las jornadas viejas: se reparte en partes iguales. */
  viaticosDetalle: Record<string, number>;
  viaticosLosPaga: "cliente" | "agencia";
  /** [0] dirige, [1] acompaña. */
  asistentes: string[];
  cobrado: number | null;
  cobradoAt: string | null;
  pagos: Record<string, Pago>;
  confirmadaAt: string | null;
}

export interface Parte {
  userId: string;
  rol: "dirige" | "acompaña";
  /** Su parte del trabajo (50% o 30% del precio). */
  trabajo: number;
  viaticos: number;
  total: number;
  pagado: number;
  debe: number;
}

export type EstadoJornada = "agendada" | "completar" | "cobrar" | "pagar" | "cerrada";

export const ESTADO_JORNADA: Record<EstadoJornada, { label: string; emoji: string }> = {
  agendada: { label: "Agendada", emoji: "📅" },
  completar: { label: "Falta completar", emoji: "✍️" },
  cobrar: { label: "Falta cobrar", emoji: "💰" },
  pagar: { label: "Falta pagar", emoji: "🤝" },
  cerrada: { label: "Cerrada", emoji: "✅" },
};

function viaticosDe(j: JornadaRegistro, userId: string | null): number | null {
  if (!userId) return null;
  if (Object.keys(j.viaticosDetalle).length) return Math.max(0, Number(j.viaticosDetalle[userId] ?? 0));
  return Math.round(j.viaticos / Math.max(1, Math.min(2, j.asistentes.length)));
}

export function repartoJornada(j: JornadaRegistro) {
  const [dir, aco] = [j.asistentes[0] ?? null, j.asistentes[1] ?? null];
  const vDir = viaticosDe(j, dir) ?? 0;
  const vAco = viaticosDe(j, aco);
  const split = splitJornada({
    precio: j.monto,
    viaticos: j.viaticos,
    hasAcompanante: !!aco,
    viaticosLosPaga: j.viaticosLosPaga,
    viaticosPersona: [vDir, vAco],
  });
  const parte = (userId: string, rol: Parte["rol"], total: number, viaticos: number): Parte => {
    const pagado = Number(j.pagos[userId]?.monto ?? 0);
    return { userId, rol, trabajo: total - viaticos, viaticos, total, pagado, debe: Math.max(0, total - pagado) };
  };
  const partes: Parte[] = [];
  if (dir) partes.push(parte(dir, "dirige", split.director, vDir));
  if (aco && split.acompanante != null) partes.push(parte(aco, "acompaña", split.acompanante, vAco ?? 0));
  const cobrado = Number(j.cobrado ?? 0);
  return {
    partes,
    /** Lo que hay que cobrarle al cliente: el precio, más los viáticos si los paga él. */
    aCobrar: split.totalCliente,
    faltaCobrar: Math.max(0, split.totalCliente - cobrado),
    faltaPagar: partes.reduce((n, p) => n + p.debe, 0),
    agencia: split.agencia,
  };
}

/** En qué está: lo primero que falta resolver. */
export function estadoJornada(j: JornadaRegistro, hoy: string): EstadoJornada {
  if (j.fecha >= hoy && !j.confirmadaAt) return "agendada";
  if (!j.confirmadaAt) return "completar";
  const r = repartoJornada(j);
  if (r.faltaCobrar > 0) return "cobrar";
  if (r.faltaPagar > 0) return "pagar";
  return "cerrada";
}

/** El resumen de arriba: cuánto falta cobrar y pagar, y a quién se le debe. */
export function resumenJornadas(js: JornadaRegistro[], hoy: string) {
  let faltaCobrar = 0;
  let completar = 0;
  const debePorPersona = new Map<string, number>();
  for (const j of js) {
    const e = estadoJornada(j, hoy);
    if (e === "completar") completar++;
    if (e === "agendada" || e === "completar") continue;
    const r = repartoJornada(j);
    faltaCobrar += r.faltaCobrar;
    for (const p of r.partes) if (p.debe > 0) debePorPersona.set(p.userId, (debePorPersona.get(p.userId) ?? 0) + p.debe);
  }
  const faltaPagar = [...debePorPersona.values()].reduce((a, b) => a + b, 0);
  return { faltaCobrar, faltaPagar, completar, debePorPersona };
}

/** Lo que va en el aviso al dueño cuando Luz confirma una jornada. */
export function avisoJornadaLista(cliente: string, j: JornadaRegistro, nombre: (id: string) => string, fmt: (n: number) => string): string {
  const r = repartoJornada(j);
  const pagar = r.partes.map((p) => `${nombre(p.userId)} ${fmt(p.total)}`).join(", ");
  return `🎬 Jornada de ${cliente} lista: cobrar ${fmt(r.aCobrar)} · pagar a ${pagar}.`;
}
