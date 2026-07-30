/**
 * "Conseguir clientes": qué hacer HOY para traer cuentas sin gastar en pauta.
 *
 * De dónde sale: la agencia cierra ~5,7 clientes por mes y quiere 10 en 10 días
 * sin plata para más pauta. Los canales que ya están pagos y sin usar son tres:
 *
 *  1. REFERIDOS de los clientes activos — el de mayor conversión y costo cero.
 *     Nunca se pidió ni una vez.
 *  2. REACTIVAR cuentas perdidas — ya conocen el producto, el ciclo es corto.
 *  3. CONTACTOS ya cargados que nadie contactó — se pagaron con tokens o con
 *     Google y están muertos en la tabla.
 *
 * Todo este módulo es puro: arma la lista y los mensajes, no toca base ni red.
 */

export type TipoAccion = "referido" | "reactivacion";

export interface ClienteParaPedir {
  id: string;
  nombre: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  rubro: string | null;
  monto_mensual: number | null;
  /** ISO. Alta (activos) o baja (perdidos). */
  fecha: string | null;
}

export interface AccionDelDia {
  tipo: TipoAccion;
  clienteId: string;
  empresa: string;
  persona: string | null;
  telefono: string | null;
  /** Por qué está en la lista, en criollo. */
  motivo: string;
  /** Cuanto más alto, antes hay que hacerlo. */
  prioridad: number;
  mensaje: string;
}

/**
 * Meses enteros entre dos fechas ISO (0 si falta el dato).
 *
 * Se leen los dígitos del string en vez de usar `new Date`: un timestamp UTC
 * ("2026-07-01T00:00:00Z") interpretado en Córdoba (UTC-3) cae en junio, y el
 * mensaje terminaba diciéndole "hace 1 mes" a un cliente que arrancó ayer.
 */
export function mesesEntre(desdeIso: string | null, hastaIso: string): number {
  const partes = (iso: string | null): [number, number] | null => {
    const m = iso?.match(/^(\d{4})-(\d{2})/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const d = partes(desdeIso);
  const h = partes(hastaIso);
  if (!d || !h) return 0;
  return Math.max(0, (h[0] - d[0]) * 12 + (h[1] - d[1]));
}

/** Primer nombre, que es como se saluda por WhatsApp. */
export function primerNombre(nombre: string | null): string | null {
  const n = nombre?.trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : null;
}

/**
 * Mensaje para pedir un referido.
 *
 * Reglas que lo hacen funcionar (y por las que no es un texto genérico):
 *  · Pide UNA persona concreta, no "si conocés a alguien". El pedido abierto no
 *    se responde; el pedido específico sí.
 *  · Nombra el rubro del propio cliente: le da un ejemplo de a quién pensar.
 *  · El incentivo va al final y es opcional: sin incentivo también funciona
 *    cuando el cliente está contento.
 */
export function mensajeReferido(input: {
  empresa: string;
  persona: string | null;
  rubro: string | null;
  meses: number;
  incentivo?: string | null;
}): string {
  const hola = input.persona ? `Hola ${input.persona}!` : "Hola!";
  const tiempo =
    input.meses >= 2
      ? `Venimos trabajando hace ${input.meses} meses juntos y la verdad que le agarramos la vuelta a ${input.empresa}.`
      : `Arrancamos hace poco con ${input.empresa} y estoy muy contento con cómo viene.`;
  const rubro = input.rubro?.trim();
  const ejemplo = rubro
    ? `Alguien de ${rubro.toLowerCase()} o de un rubro parecido al tuyo sería ideal.`
    : `Puede ser de cualquier rubro.`;
  const incentivo = input.incentivo?.trim()
    ? `\n\nY si cierra, ${input.incentivo.trim()}.`
    : "";

  return (
    `${hola} ${tiempo}\n\n` +
    `Te hago una consulta: estoy abriendo lugar para algunas cuentas nuevas este mes. ` +
    `¿Se te ocurre UNA persona que tenga un negocio y que hoy esté flojo con las redes? ` +
    `${ejemplo}\n\n` +
    `Con que me pases el nombre y el Instagram me alcanza, del resto me encargo yo.${incentivo}`
  );
}

/**
 * Mensaje para reconquistar una cuenta perdida. No pide perdón ni insiste con
 * lo que pasó: ofrece algo nuevo y concreto, que es lo único que reabre la
 * conversación.
 */
export function mensajeReactivacion(input: {
  empresa: string;
  persona: string | null;
  mesesDesdeBaja: number;
  montoAnterior?: number | null;
}): string {
  const hola = input.persona ? `Hola ${input.persona}, ¿cómo va?` : "Hola, ¿cómo va?";
  const tiempo =
    input.mesesDesdeBaja >= 2
      ? `Pasaron unos meses desde la última vez que trabajamos juntos.`
      : `Hace poco dejamos de trabajar juntos.`;

  return (
    `${hola} ${tiempo}\n\n` +
    `Te escribo porque cambiamos bastante la forma de trabajar desde entonces y me quedé ` +
    `con ganas de mostrarte cómo quedó ${input.empresa} en la propuesta nueva.\n\n` +
    `¿Te hago una revisión gratis de las redes y te la mando en un video de 5 minutos? ` +
    `Si te sirve, hablamos; y si no, te queda igual.`
  );
}

/** Prioriza a los clientes que más probablemente refieran (y con teléfono). */
function prioridadReferido(meses: number, tieneTel: boolean): number {
  // Un cliente con varios meses ya vio resultados: es el que refiere.
  const p = 50 + Math.min(meses, 12) * 4;
  // Sin teléfono no se le puede escribir desde acá: al fondo de la lista,
  // aunque sea el cliente más antiguo. Si no, tapa a los que sí se pueden hacer.
  return tieneTel ? p : p - 200;
}

function prioridadReactivacion(mesesDesdeBaja: number, monto: number | null): number {
  // Cuanto más reciente la baja, más fácil volver. Y el que pagaba más, vale más.
  let p = 40 - Math.min(mesesDesdeBaja, 12) * 3;
  if (monto) p += Math.min(monto / 100_000, 6);
  return p;
}

/**
 * Arma la lista del día. `yaHechos` son los target_id que ya se trabajaron
 * (vienen del outreach_log): no se repiten.
 */
export function armarPlan(input: {
  activos: ClienteParaPedir[];
  perdidos: ClienteParaPedir[];
  yaHechos: { tipo: TipoAccion; targetId: string }[];
  hoy: string;
  incentivo?: string | null;
}): AccionDelDia[] {
  const hechos = new Set(input.yaHechos.map((h) => `${h.tipo}:${h.targetId}`));
  const out: AccionDelDia[] = [];

  for (const c of input.activos) {
    if (hechos.has(`referido:${c.id}`)) continue;
    const meses = mesesEntre(c.fecha, input.hoy);
    const persona = primerNombre(c.contacto_nombre);
    out.push({
      tipo: "referido",
      clienteId: c.id,
      empresa: c.nombre,
      persona,
      telefono: c.contacto_telefono,
      motivo:
        meses >= 2
          ? `Cliente hace ${meses} meses — ya vio resultados`
          : "Cliente nuevo, arrancó contento",
      prioridad: prioridadReferido(meses, !!c.contacto_telefono),
      mensaje: mensajeReferido({
        empresa: c.nombre,
        persona,
        rubro: c.rubro,
        meses,
        incentivo: input.incentivo,
      }),
    });
  }

  for (const c of input.perdidos) {
    if (hechos.has(`reactivacion:${c.id}`)) continue;
    const meses = mesesEntre(c.fecha, input.hoy);
    const persona = primerNombre(c.contacto_nombre);
    out.push({
      tipo: "reactivacion",
      clienteId: c.id,
      empresa: c.nombre,
      persona,
      telefono: c.contacto_telefono,
      motivo: c.monto_mensual
        ? `Pagaba $${c.monto_mensual.toLocaleString("es-AR")} · se fue hace ${meses} ${meses === 1 ? "mes" : "meses"}`
        : `Se fue hace ${meses} ${meses === 1 ? "mes" : "meses"}`,
      prioridad: prioridadReactivacion(meses, c.monto_mensual),
      mensaje: mensajeReactivacion({
        empresa: c.nombre,
        persona,
        mesesDesdeBaja: meses,
        montoAnterior: c.monto_mensual,
      }),
    });
  }

  return out.sort((a, b) => b.prioridad - a.prioridad);
}

/**
 * Cuántas altas hacen falta por día para llegar a la meta, y si el ritmo actual
 * alcanza. Sirve para que la pantalla diga la verdad en vez de motivar al pedo.
 */
export function ritmoNecesario(input: {
  meta: number;
  yaConseguidos: number;
  diasHabilesRestantes: number;
  altasPorMesHistorico: number;
}): {
  faltan: number;
  porDia: number;
  ritmoHistoricoPorDia: number;
  alcanza: boolean;
} {
  const faltan = Math.max(0, input.meta - input.yaConseguidos);
  const dias = Math.max(1, input.diasHabilesRestantes);
  const porDia = faltan / dias;
  // 22 días hábiles por mes.
  const ritmoHistoricoPorDia = input.altasPorMesHistorico / 22;
  return {
    faltan,
    porDia: Math.round(porDia * 100) / 100,
    ritmoHistoricoPorDia: Math.round(ritmoHistoricoPorDia * 100) / 100,
    alcanza: ritmoHistoricoPorDia >= porDia,
  };
}
