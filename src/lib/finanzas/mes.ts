/**
 * "La plata del mes": el resumen de acción del período — a quién le cobro, a
 * quién le pago, cuánto y por qué.
 *
 * Todo acá es PURO (entra data, sale texto o números) para poder testearlo. Las
 * pantallas solo traen las filas y las pintan.
 */
import { fmtCurrency, periodLabel } from "@/lib/finanzas";
import { AGENCY } from "@/lib/agency";

export interface LineaPago {
  concepto: string;
  cliente: string | null;
  monto: number;
}

/**
 * Mensaje de aviso de pago para una persona del equipo. Lleva el detalle de a
 * qué corresponde cada peso: es lo que evita el ida y vuelta de "¿y esto por
 * qué?" cuando alguien cobra distinto que el mes pasado.
 *
 * Sin emoji fuera del plano básico: WhatsApp Web los corrompe al precargar el
 * texto desde wa.me (misma razón que en los recordatorios de cobro).
 */
export function buildTeamPaymentMessage(input: {
  nombre: string;
  periodo: string;
  total: number;
  lineas: LineaPago[];
  /** Alias o CBU de la persona, para confirmarle dónde se transfiere. */
  alias?: string | null;
  /** Quién firma el mensaje. */
  deParte?: string | null;
}): string {
  const { nombre, periodo, total, lineas, alias, deParte } = input;
  const primerNombre = nombre.trim().split(/\s+/)[0];
  const mes = periodLabel(periodo);

  const detalle = lineas
    .filter((l) => l.monto !== 0)
    .map((l) => {
      const donde = l.cliente && l.cliente !== "—" ? `${l.cliente} · ` : "";
      return `• ${donde}${l.concepto}: ${fmtCurrency(l.monto, "ARS")}`;
    });

  const out = [
    `¡Hola ${primerNombre}! Te paso el detalle de ${mes}.`,
    ``,
    ...(detalle.length > 0 ? [...detalle, ``] : []),
    `Total: *${fmtCurrency(total, "ARS")}*`,
  ];
  if (alias?.trim()) out.push(``, `Transferencia a: *${alias.trim()}*`);
  out.push(``, `Cualquier cosa que no te cierre, avisame y lo revisamos.`);
  if (deParte?.trim()) out.push(``, `${deParte.trim()} — ${AGENCY.brand}`);
  return out.join("\n");
}

/**
 * Recordatorio de cobro armado desde la FACTURA (no desde el abono del cliente):
 * así el monto que se le pide es exactamente el que quedó registrado, aunque
 * tenga descuento, un mes proporcional o un servicio extra.
 */
export function buildInvoiceReminder(input: {
  clienteNombre: string;
  contactoNombre?: string | null;
  periodo: string;
  monto: number;
  moneda?: string | null;
  /** Conceptos de las facturas del mes (si son varias, se listan). */
  conceptos?: string[];
}): string {
  const { clienteNombre, contactoNombre, periodo, monto, moneda, conceptos } = input;
  const saludo = contactoNombre?.trim()
    ? contactoNombre.trim().split(/\s+/)[0]
    : clienteNombre;
  const mes = periodLabel(periodo);
  const { alias, cvu, nombre: banco, titular } = AGENCY.bank;
  const montoTxt = monto > 0 ? fmtCurrency(monto, moneda || "ARS") : "(monto a confirmar)";

  const detalle =
    conceptos && conceptos.length > 1
      ? [...conceptos.map((c) => `• ${c}`), ``]
      : [];

  return [
    `¡Hola ${saludo}! Te escribo de ${AGENCY.brand}.`,
    ``,
    `Arrancamos con ${mes} y te paso el recordatorio de tu abono: *${montoTxt}*.`,
    ...(detalle.length > 0 ? [``, ...detalle] : [``]),
    `Podés transferir por ${banco} a:`,
    `• Alias: *${alias}*`,
    `• CVU: ${cvu}`,
    `• Nombre: ${titular}`,
    ``,
    `Cuando lo tengas, mandame el comprobante y seguimos a full con tu contenido. ¡Gracias!`,
  ].join("\n");
}

export interface ResumenMes {
  aCobrar: number;
  cobrado: number;
  pendienteCobrar: number;
  aPagar: number;
  pagado: number;
  pendientePagar: number;
  /** Lo que queda si entra todo y se paga todo. */
  resultado: number;
  /** Lo que hay hoy en la mano: cobrado menos pagado. */
  resultadoReal: number;
}

/** Los seis números de arriba de la pantalla. */
export function resumirMes(input: {
  facturas: { monto: number; cobrada: boolean }[];
  pagos: { monto: number; pagado: boolean }[];
}): ResumenMes {
  const aCobrar = input.facturas.reduce((a, f) => a + f.monto, 0);
  const cobrado = input.facturas.filter((f) => f.cobrada).reduce((a, f) => a + f.monto, 0);
  const aPagar = input.pagos.reduce((a, p) => a + p.monto, 0);
  const pagado = input.pagos.filter((p) => p.pagado).reduce((a, p) => a + p.monto, 0);
  return {
    aCobrar,
    cobrado,
    pendienteCobrar: aCobrar - cobrado,
    aPagar,
    pagado,
    pendientePagar: aPagar - pagado,
    resultado: aCobrar - aPagar,
    resultadoReal: cobrado - pagado,
  };
}
