/**
 * Puntualidad de contenido: ¿el calendario que cargamos se está cumpliendo?
 *
 * El semáforo del Director ya miraba "piezas publicadas vs cuota del pack", que
 * no ve el problema real: piezas cargadas en el calendario con la fecha YA
 * PASADA que nunca salieron. En julio 2026 eran 77 de una — y nadie se enteraba
 * hasta que el cliente preguntaba.
 *
 * Distinguimos dos incumplimientos, porque se resuelven distinto:
 *  - NUNCA ARRANCÓ (quedó en "idea" y se pasó la fecha) → falta producirla.
 *  - TRABADA (está en revisión/edición/aprobada y se pasó la fecha) → está hecha
 *    pero alguien no la destrabó. Es la más barata de arreglar.
 *
 * Todo el módulo es puro para poder testearlo.
 */

/** Estados en los que una pieza ya se trabajó pero todavía no salió. */
export const ESTADOS_TRABADA = [
  "revision_creativa",
  "revision_cliente",
  "aprobado",
  "edicion",
] as const;

export interface PubParaPuntualidad {
  cliente_id: string;
  estado: string;
  /** ISO. Puede venir con hora. */
  fecha_publicacion: string | null;
}

export type ClasePieza =
  | "publicada"
  | "nunca_arranco"
  | "trabada"
  | "pendiente_futura"
  | "sin_fecha";

/** En qué situación está una pieza respecto de hoy. */
export function clasificarPieza(p: PubParaPuntualidad, hoy: string): ClasePieza {
  if (p.estado === "publicado") return "publicada";
  const fecha = p.fecha_publicacion?.slice(0, 10);
  if (!fecha) return "sin_fecha";
  if (fecha >= hoy) return "pendiente_futura";
  if (p.estado === "idea") return "nunca_arranco";
  if ((ESTADOS_TRABADA as readonly string[]).includes(p.estado)) return "trabada";
  // Rechazada/otros con fecha pasada: también es algo que no salió.
  return "trabada";
}

export type SemaforoPuntualidad = "bien" | "regular" | "mal" | "sin_datos";

export interface PuntualidadCuenta {
  clienteId: string;
  /** Piezas del período cargadas en el calendario. */
  planificadas: number;
  publicadas: number;
  /** Se pasó la fecha y quedaron en "idea": nunca se produjeron. */
  nuncaArrancaron: number;
  /** Se pasó la fecha estando en revisión/edición: hechas pero no destrabadas. */
  trabadas: number;
  /** Todavía no les llegó la fecha. */
  porVenir: number;
  /** Piezas cuya fecha ya pasó (publicadas o no). Es la base del %. */
  vencidasTotal: number;
  /** % de lo que ya debería haber salido y salió. null = base muy chica. */
  ejecucionPct: number | null;
  semaforo: SemaforoPuntualidad;
  /** Frases listas para mostrar. */
  alertas: string[];
}

/** Mínimo de piezas con fecha pasada para opinar (si no, un atraso da 0%). */
const BASE_MINIMA = 3;

export function computePuntualidadCuenta(
  clienteId: string,
  pubs: PubParaPuntualidad[],
  hoy: string
): PuntualidadCuenta {
  let publicadas = 0;
  let nuncaArrancaron = 0;
  let trabadas = 0;
  let porVenir = 0;

  for (const p of pubs) {
    switch (clasificarPieza(p, hoy)) {
      case "publicada":
        publicadas++;
        break;
      case "nunca_arranco":
        nuncaArrancaron++;
        break;
      case "trabada":
        trabadas++;
        break;
      case "pendiente_futura":
        porVenir++;
        break;
    }
  }

  const atrasadas = nuncaArrancaron + trabadas;
  const vencidasTotal = publicadas + atrasadas;
  const ejecucionPct =
    vencidasTotal >= BASE_MINIMA ? Math.round((publicadas / vencidasTotal) * 100) : null;

  let semaforo: SemaforoPuntualidad = "sin_datos";
  if (pubs.length === 0) semaforo = "sin_datos";
  else if (ejecucionPct == null) semaforo = atrasadas > 0 ? "regular" : "bien";
  else if (ejecucionPct < 50) semaforo = "mal";
  else if (ejecucionPct < 80) semaforo = "regular";
  else semaforo = "bien";

  const alertas: string[] = [];
  if (pubs.length === 0) {
    alertas.push("No tiene calendario cargado este mes");
  } else {
    if (nuncaArrancaron > 0)
      alertas.push(
        `${nuncaArrancaron} pieza${nuncaArrancaron === 1 ? "" : "s"} con la fecha pasada sin producir`
      );
    if (trabadas > 0)
      alertas.push(
        `${trabadas} pieza${trabadas === 1 ? "" : "s"} trabada${trabadas === 1 ? "" : "s"} en revisión con la fecha pasada`
      );
  }

  return {
    clienteId,
    planificadas: pubs.length,
    publicadas,
    nuncaArrancaron,
    trabadas,
    porVenir,
    vencidasTotal,
    ejecucionPct,
    semaforo,
    alertas,
  };
}

/** Lo mismo para varias cuentas de una. Las cuentas sin piezas también entran. */
export function computePuntualidad(
  clienteIds: string[],
  pubs: PubParaPuntualidad[],
  hoy: string
): Map<string, PuntualidadCuenta> {
  const porCliente = new Map<string, PubParaPuntualidad[]>();
  for (const id of clienteIds) porCliente.set(id, []);
  for (const p of pubs) {
    const arr = porCliente.get(p.cliente_id);
    if (arr) arr.push(p);
  }
  const out = new Map<string, PuntualidadCuenta>();
  for (const [id, lista] of porCliente) {
    out.set(id, computePuntualidadCuenta(id, lista, hoy));
  }
  return out;
}

/** Cuánto suma al score de riesgo del Director (mayor = peor). */
export function scorePuntualidad(p: PuntualidadCuenta): number {
  if (p.semaforo === "mal") return 2;
  if (p.semaforo === "regular") return 1;
  // Una cuenta activa sin nada cargado es tan grave como estar muy atrasado.
  if (p.planificadas === 0) return 2;
  return 0;
}
