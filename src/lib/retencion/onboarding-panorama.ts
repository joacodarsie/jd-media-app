/**
 * El panorama de los arranques: todas las cuentas nuevas en una sola pantalla.
 *
 * Antes esto vivía desparramado: la ficha de cada cliente tenía CUATRO botones
 * de onboarding (general, redes, CM, diseño) y no había ningún lugar donde ver
 * cómo venían los arranques de todas las cuentas juntas. Para saber si una
 * cuenta nueva iba bien había que entrar cuenta por cuenta — y por eso nadie
 * miraba, que es la misma razón por la que el onboarding no se creaba nunca
 * (ver `onboarding-pendiente.ts`).
 *
 * Acá el arranque se lee como lo que es: una línea de tiempo de 15 días con
 * pasos que se cumplen o se atrasan.
 *
 * Módulo PURO: entran los tickets y sus pasos, sale el panorama ordenado.
 */
import { DIAS_ONBOARDING, sumarDias } from "./onboarding-15";
import { diasEntre } from "./onboarding-pendiente";

const HECHO = new Set(["completada", "archivada"]);

export interface PasoCrudo {
  id: string;
  numero: number | null;
  titulo: string;
  estado: string;
  area: string | null;
  fecha_limite: string | null;
  asignado_nombre: string | null;
}

export interface ArranqueCrudo {
  ticketId: string;
  numero: number | null;
  clienteId: string;
  clienteNombre: string;
  /** "YYYY-MM-DD". El día 1 del arranque. */
  fechaInicio: string;
  pasos: PasoCrudo[];
}

export interface PasoDelArranque extends PasoCrudo {
  /** Día del arranque al que corresponde (1 = el primero). */
  dia: number;
  hecho: boolean;
  /** Venció y no está hecho. */
  atrasado: boolean;
}

export interface ArranqueEnCurso {
  ticketId: string;
  numero: number | null;
  clienteId: string;
  clienteNombre: string;
  fechaInicio: string;
  /** "YYYY-MM-DD" del último día de los 15. */
  fechaFin: string;
  /** En qué día del arranque está hoy (1..15, o más si se pasó). */
  diaActual: number;
  /** 0..1 */
  pct: number;
  hechos: number;
  total: number;
  atrasados: number;
  /** Ya se cumplieron los 15 días y todavía queda algo. */
  vencido: boolean;
  /** Todos los pasos están hechos. */
  terminado: boolean;
  pasos: PasoDelArranque[];
}

function armarPasos(a: ArranqueCrudo, hoy: string): PasoDelArranque[] {
  return a.pasos
    .map((p) => {
      const hecho = HECHO.has(p.estado);
      const limite = p.fecha_limite ? p.fecha_limite.slice(0, 10) : null;
      return {
        ...p,
        // El plan fecha cada paso como inicio + dia (ver filasDelPlan), así
        // que el día del plan es la diferencia pelada, sin sumarle uno.
        dia: limite ? Math.max(1, diasEntre(a.fechaInicio, limite)) : 1,
        hecho,
        atrasado: !hecho && !!limite && limite < hoy,
      };
    })
    .sort((x, y) => x.dia - y.dia || x.titulo.localeCompare(y.titulo));
}

/**
 * Arma el panorama.
 *
 * El orden importa más de lo que parece: primero lo que está en problemas. Una
 * lista ordenada por fecha deja lo urgente abajo y termina siendo una lista que
 * no se mira.
 */
export function panoramaDeArranques(
  arranques: ArranqueCrudo[],
  hoy: string
): ArranqueEnCurso[] {
  return arranques
    .map((a): ArranqueEnCurso => {
      const pasos = armarPasos(a, hoy);
      const total = pasos.length;
      const hechos = pasos.filter((p) => p.hecho).length;
      const diaActual = Math.max(1, diasEntre(a.fechaInicio, hoy));
      const terminado = total > 0 && hechos === total;
      return {
        ticketId: a.ticketId,
        numero: a.numero,
        clienteId: a.clienteId,
        clienteNombre: a.clienteNombre,
        fechaInicio: a.fechaInicio,
        fechaFin: sumarDias(a.fechaInicio, DIAS_ONBOARDING),
        diaActual,
        pct: total ? hechos / total : 0,
        hechos,
        total,
        atrasados: pasos.filter((p) => p.atrasado).length,
        vencido: diaActual > DIAS_ONBOARDING && !terminado,
        terminado,
        pasos,
      };
    })
    .sort((a, b) => {
      if (a.terminado !== b.terminado) return a.terminado ? 1 : -1;
      if (a.atrasados !== b.atrasados) return b.atrasados - a.atrasados;
      return b.diaActual - a.diaActual;
    });
}

/** Un resumen de una línea para el encabezado de la pantalla. */
export function resumenDeArranques(filas: ArranqueEnCurso[]): {
  enCurso: number;
  conAtraso: number;
  pasosAtrasados: number;
} {
  const enCurso = filas.filter((f) => !f.terminado);
  return {
    enCurso: enCurso.length,
    conAtraso: enCurso.filter((f) => f.atrasados > 0).length,
    pasosAtrasados: enCurso.reduce((a, f) => a + f.atrasados, 0),
  };
}
