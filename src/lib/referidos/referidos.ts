/**
 * Programa de referidos (13/10/2026). Reglas que definió el dueño:
 *
 * - Recomienda cualquier cliente con 2 meses o más (ya conoce cómo trabajamos).
 * - El que recomienda: 10% de descuento en su próxima factura por cada
 *   recomendado, sin tope. Se gana cuando el recomendado paga su 2.º mes: las
 *   bajas pasan en el arranque y no queremos pagar por altas que se caen.
 * - El recomendado: 10% de descuento en su primer mes.
 *
 * Puro: las reglas y los textos. El ejecutor (`run.ts`) habla con la base.
 */
export const PCT_REFERIDO = 10;
export const PCT_RECOMENDADO = 10;
export const DIAS_PARA_RECOMENDAR = 60;
export const MESES_PAGOS_PARA_GANAR = 2;
export const WEB = "https://jdmedia.com.ar";

/** Ya puede recomendar: lleva 2 meses o más con nosotros. */
export function puedeRecomendar(fechaInicio: string | null | undefined, hoy: string): boolean {
  const ini = (fechaInicio ?? "").slice(0, 10);
  if (!ini) return false;
  const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${ini}T12:00:00Z`)) / 86_400_000;
  return dias >= DIAS_PARA_RECOMENDAR;
}

/** El recomendado ya pagó su 2.º mes: los períodos con al menos un abono cobrado. */
export function estaGanado(periodosPagados: string[]): boolean {
  return new Set(periodosPagados).size >= MESES_PAGOS_PARA_GANAR;
}

/** El 10% del abono del mes del que recomendó, redondeado a $100. */
export function descuentoReferido(abonoDelMes: number): number {
  if (!(abonoDelMes > 0)) return 0;
  return Math.round((abonoDelMes * PCT_REFERIDO) / 100 / 100) * 100;
}

export function linkReferido(code: string): string {
  return `${WEB}/?ref=${encodeURIComponent(code)}`;
}

/** El mensaje que el cliente reenvía por WhatsApp. Sin emoji astrales (WhatsApp Web los rompe). */
export function mensajeReferido(code: string): string {
  return `Te recomiendo JD Media, la agencia que me maneja las redes. Trabajan muy bien y con mi link tenés un ${PCT_RECOMENDADO}% de descuento en tu primer mes: ${linkReferido(code)}`;
}

export function linkWhatsappReferido(code: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeReferido(code))}`;
}

export function conceptoDescuento(nombreRecomendado: string, periodo: string): string {
  return `Descuento por recomendar a ${nombreRecomendado} (${PCT_REFERIDO}%) — ${periodo}`;
}

export type EstadoReferido = "pendiente" | "ganado" | "aplicado";

export function labelEstado(e: EstadoReferido): string {
  if (e === "pendiente") return "esperando su 2.º pago";
  if (e === "ganado") return "descuento ganado, va en tu próxima factura";
  return "descuento aplicado";
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * El cliente que recomendó, a partir de lo que escribieron en «¿Quién lo
 * recomendó?»: igual al nombre (sin tildes ni mayúsculas) o, si no, el único
 * cliente cuyo nombre aparece en el texto. Si no es ningún cliente (una
 * persona, un amigo), null: no hay descuento que dar.
 */
export function clienteQueRecomendo(
  detalle: string | null | undefined,
  clientes: { id: string; nombre: string }[]
): string | null {
  const d = norm(detalle ?? "");
  if (d.length < 3) return null;
  const exacto = clientes.find((c) => norm(c.nombre) === d);
  if (exacto) return exacto.id;
  const contiene = clientes.filter((c) => norm(c.nombre).length >= 3 && d.includes(norm(c.nombre)));
  return contiene.length === 1 ? contiene[0].id : null;
}

/**
 * La tarea de la PM al cumplir 2 meses cada cuenta: contarle el programa
 * (13/10/2026). Solo las que cumplieron entre 60 y 90 días: las más viejas se
 * repartieron una vez a mano y no se vuelven a pedir.
 */
export function tareasContarReferidos(
  clientes: { id: string; nombre: string; fecha_inicio: string | null }[],
  hoy: string,
  pmId: string | null
): {
  rutina_key: string;
  titulo: string;
  descripcion: string;
  area: string;
  prioridad: string;
  asignado_a_id: string | null;
  cliente_id: string | null;
  fecha_limite: string;
}[] {
  if (!pmId) return [];
  const limite = new Date(`${hoy}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 3);
  return clientes
    .filter((c) => {
      if (!puedeRecomendar(c.fecha_inicio, hoy)) return false;
      const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${c.fecha_inicio!.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
      return dias < 90;
    })
    .map((c) => ({
      rutina_key: `ref:contar:${c.id}`,
      titulo: `Contarle a ${c.nombre} el programa de referidos`,
      descripcion: `${c.nombre} cumplió 2 meses con nosotros: ya puede recomendarnos. En la próxima charla (o por WhatsApp) contale:\n\n- En su plataforma tiene el botón **«Recomendanos»** con su link y el mensaje listo para reenviar.\n- La marca que recomiende tiene **${PCT_RECOMENDADO}% de descuento en su primer mes**.\n- Y ${c.nombre} tiene **${PCT_REFERIDO}% de descuento en su próxima factura** por cada marca que se sume, sin tope (se aplica cuando la recomendada paga su 2.º mes).\n\nEl mejor momento: justo después de mostrarle buenos resultados.`,
      area: "Coordinación",
      prioridad: "media",
      asignado_a_id: pmId,
      cliente_id: c.id,
      fecha_limite: limite.toISOString().slice(0, 10),
    }));
}
