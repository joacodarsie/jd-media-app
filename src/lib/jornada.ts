/**
 * Reparto de una jornada de producción.
 *
 * Modelo (confirmado por el dueño el 11/9/2026), para las jornadas que van
 * DENTRO del servicio de gestión de redes:
 *  - PRECIO al cliente: **$50.000 la primera hora + $25.000 cada hora extra**,
 *    más los viáticos. Van dos personas con micrófonos, celulares y guiones a
 *    grabar el contenido del mes.
 *  - El precio se reparte **50% quien dirige, 30% el acompañante, 20% la
 *    agencia**.
 *  - Los **viáticos van enteros a quienes los pusieron**, en partes iguales, y
 *    quedan FUERA del reparto: no son ganancia de nadie, son un reintegro.
 *  - Se cobra al finalizar la jornada.
 *
 * Por qué los viáticos son un dato y no una constante: antes estaban fijos en
 * $25.000 y se descontaban del monto antes de repartir. Una jornada a diez
 * cuadras descontaba $25.000 que nadie gastó (y el equipo cobraba de menos);
 * una en las sierras gastaba mucho más y la diferencia se la comía el reparto.
 *
 * Las jornadas PERSONALIZADAS (producción de contenido como servicio aparte,
 * fuera de gestión de redes) no siguen esta tarifa: se cotizan caso por caso.
 *
 * En `production_sessions.asistentes`, por convención: [0] = director/a,
 * [1] = acompañante (opcional).
 */
export const JORNADA_PRECIO_HORA = 50000;
export const JORNADA_PRECIO_HORA_EXTRA = 25000;
export const JORNADA_PCT_DIRECTOR = 0.5;
export const JORNADA_PCT_ACOMPANANTE = 0.3;
export const JORNADA_PCT_AGENCIA = 0.2;

/**
 * Viáticos del modelo viejo. Se conserva SOLO para leer jornadas cargadas antes
 * de la migración 0163, que guardaban los viáticos adentro del monto.
 */
export const JORNADA_VIATICOS_LEGACY = 25000;

/** Lo que sale una jornada de N horas, sin viáticos. */
export function precioJornada(horas: number): number {
  const h = Number.isFinite(horas) && horas > 0 ? horas : 1;
  const extras = Math.max(0, h - 1);
  return Math.round(JORNADA_PRECIO_HORA + extras * JORNADA_PRECIO_HORA_EXTRA);
}

export interface JornadaSplit {
  /** Lo que se cobra por el trabajo, sin viáticos. Es lo que se reparte. */
  precio: number;
  /** Viáticos totales, que se reintegran enteros a quienes fueron. */
  viaticos: number;
  /** Lo que se le factura al cliente: precio + viáticos si los paga él. */
  totalCliente: number;
  viaticosPorPersona: number;
  director: number;
  acompanante: number | null;
  /** Lo que queda para la agencia. Si la agencia pone los viáticos, los resta. */
  agencia: number;
}

export interface JornadaInputSplit {
  /** Precio del trabajo, sin viáticos. */
  precio: number;
  viaticos: number;
  hasAcompanante: boolean;
  /** Quién pone los viáticos. Si es la agencia, salen de su parte. */
  viaticosLosPaga?: "cliente" | "agencia";
}

/**
 * Reparte una jornada.
 *
 * Los viáticos se suman a lo que cobra cada persona pero NO entran en el 50/30:
 * son plata que ya pusieron de su bolsillo. Si los paga la agencia, salen de su
 * 20%; si los paga el cliente, se le facturan aparte y la agencia queda igual.
 */
export function splitJornada(input: JornadaInputSplit): JornadaSplit {
  const precio = Math.max(0, Number(input.precio) || 0);
  const viaticos = Math.max(0, Number(input.viaticos) || 0);
  const numPersonas = input.hasAcompanante ? 2 : 1;
  const viaticosPorPersona = Math.round(viaticos / numPersonas);

  const director = viaticosPorPersona + Math.round(precio * JORNADA_PCT_DIRECTOR);
  const acompanante = input.hasAcompanante
    ? viaticosPorPersona + Math.round(precio * JORNADA_PCT_ACOMPANANTE)
    : null;

  const losPagaElCliente = (input.viaticosLosPaga ?? "agencia") === "cliente";
  const totalCliente = precio + (losPagaElCliente ? viaticos : 0);
  // Lo que le queda a la agencia: lo que entra menos lo que paga.
  const agencia = totalCliente - director - (acompanante ?? 0);

  return { precio, viaticos, totalCliente, viaticosPorPersona, director, acompanante, agencia };
}

/**
 * Compat con las jornadas cargadas antes de 0163, donde `monto` traía los
 * viáticos adentro. Se usa cuando la fila todavía no tiene `viaticos` propio.
 */
export function computeJornadaSplit(monto: number, hasAcompanante: boolean): JornadaSplit {
  const m = Number.isFinite(monto) ? Math.max(0, monto) : 0;
  const viaticos = Math.min(JORNADA_VIATICOS_LEGACY, m);
  return splitJornada({
    precio: m - viaticos,
    viaticos,
    hasAcompanante,
    viaticosLosPaga: "cliente",
  });
}

/** El monto por defecto del formulario: una hora, sin viáticos cargados. */
export const JORNADA_MONTO_DEFAULT = JORNADA_PRECIO_HORA;
