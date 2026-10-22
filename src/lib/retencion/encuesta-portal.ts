/**
 * La encuesta del mes adentro del portal (19/10/2026). Hasta acá dependía de
 * que alguien le mandara el link al cliente por WhatsApp, y en toda la historia
 * nadie la contestó: 0 respuestas. En cambio 13 de 20 clientes entran a su
 * plataforma. Se le pregunta ahí, en la segunda quincena, a quien ya lleva un
 * mes con nosotros y todavía no contestó este mes.
 */
export const DIAS_MINIMOS_ENCUESTA = 25;
export const DIA_DESDE_ENCUESTA = 15;

export function pedirEncuestaEnPortal(input: {
  /** "YYYY-MM-DD" del alta. */
  fechaInicio: string | null;
  /** "YYYY-MM-DD" de hoy (Córdoba). */
  hoy: string;
  yaRespondio: boolean;
  /**
   * Tuvo la reunión mensual hace pocos días (22/10/2026): es el mejor momento
   * para preguntar, con lo hablado fresco. Se pide aunque no sea la segunda
   * quincena (la reunión de cierre se da del 1 al 7).
   */
  reunionReciente?: boolean;
}): boolean {
  const { fechaInicio, hoy, yaRespondio, reunionReciente } = input;
  if (yaRespondio || !fechaInicio) return false;
  if (Number(hoy.slice(8, 10)) < DIA_DESDE_ENCUESTA && !reunionReciente) return false;
  const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fechaInicio.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
  return dias >= DIAS_MINIMOS_ENCUESTA;
}

/** El aviso al equipo cuando contesta un cliente. Un 3 o menos es una alarma. */
export function avisoRespuesta(nombre: string, puntaje: number, queMejorar: string | null): string {
  const mejorar = queMejorar?.trim() ? ` Qué mejorar: «${queMejorar.trim().slice(0, 140)}»` : "";
  return puntaje <= 3
    ? `🚨 ${nombre} puso ${puntaje}/5 en la encuesta del mes.${mejorar} Llamalo esta semana.`
    : `⭐ ${nombre} puso ${puntaje}/5 en la encuesta del mes.${mejorar}`;
}
