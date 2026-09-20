/**
 * La red de seguridad del onboarding de 15 días.
 *
 * El 20/9/2026 se descubrió que el onboarding **nunca se había creado para
 * ninguna cuenta**: cero tickets en toda la historia de la app. El motivo es
 * tonto y por eso mismo se va a repetir — `runOnboarding15` colgaba de un solo
 * camino (`activateClient`, el pase de "propuesta" a "activo") y las últimas
 * tres cuentas (Blasco, CATCH y Nahuel) se cargaron directamente como activas.
 * Blasco y CATCH llevaban seis días sin una sola tarea de arranque.
 *
 * Arreglar los caminos no alcanza: mañana aparece un cuarto. Por eso esto
 * existe — el cron diario pregunta "¿qué cuenta nueva no tiene su onboarding?"
 * y lo crea. Da igual cómo haya nacido la cuenta.
 *
 * El corte por antigüedad es la única regla fina: armarle un plan de 15 días a
 * una cuenta que arrancó hace tres meses no es arranque, es ruido.
 *
 * Módulo PURO: entran las cuentas y qué tickets existen, sale a quién le falta.
 */

/** Hasta cuántos días después del inicio tiene sentido armar el arranque. */
export const DIAS_PARA_ARRANCAR = 30;

export interface CuentaParaOnboarding {
  id: string;
  nombre: string;
  estado: string;
  es_interno?: boolean | null;
  /** "YYYY-MM-DD". Sin fecha de inicio no se puede fechar el plan. */
  fecha_inicio: string | null;
}

/** Días entre dos fechas "YYYY-MM-DD", leyendo los dígitos (sin zona horaria). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * A qué cuentas hay que crearles el onboarding.
 *
 * @param titulosExistentes títulos de los tickets madre que ya están en la base
 *        (incluidos los archivados: si alguien lo archivó, fue a propósito).
 * @param tituloDe cómo se arma el título del ticket madre de una cuenta.
 */
export function cuentasSinOnboarding(input: {
  cuentas: CuentaParaOnboarding[];
  titulosExistentes: string[];
  tituloDe: (nombre: string) => string;
  hoy: string;
  dias?: number;
}): CuentaParaOnboarding[] {
  const { cuentas, titulosExistentes, tituloDe, hoy } = input;
  const dias = input.dias ?? DIAS_PARA_ARRANCAR;
  const ya = new Set(titulosExistentes);

  return cuentas.filter((c) => {
    if (c.estado !== "activo") return false;
    if (c.es_interno) return false;
    if (!c.fecha_inicio) return false;
    const antiguedad = diasEntre(c.fecha_inicio, hoy);
    // Una cuenta que arranca mañana también cuenta: el plan se fecha desde su
    // inicio. Lo que se descarta es la que ya lleva demasiado andando.
    if (antiguedad > dias) return false;
    return !ya.has(tituloDe(c.nombre));
  });
}
