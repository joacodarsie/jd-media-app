import { AGENCY } from "./agency";
import { fmtCurrency, periodLabel } from "./finanzas";

export interface ReminderClient {
  nombre: string;
  contacto_nombre?: string | null;
  monto_mensual?: number | null;
  contrato_moneda?: string | null;
  contrato_descuento_pct?: number | null;
  contrato_descuento_monto?: number | null;
}

/** Campos de descuento del contrato (porcentaje o monto fijo). */
export interface ContractDiscount {
  contrato_descuento_pct?: number | null;
  contrato_descuento_monto?: number | null;
}

/**
 * Aplica el descuento del contrato a un abono base. Si hay monto fijo cargado
 * (> 0) se resta ese monto; si no, se aplica el porcentaje. Nunca baja de 0.
 * El monto fijo tiene prioridad porque en el form se elige uno u otro.
 */
export function applyContractDiscount(base: number, d: ContractDiscount): number {
  const monto = Number(d.contrato_descuento_monto ?? 0);
  if (monto > 0) return Math.max(0, Math.round(base - monto));
  const pct = Number(d.contrato_descuento_pct ?? 0);
  if (pct > 0 && pct < 100) return Math.round(base * (1 - pct / 100));
  return base;
}

/** Primer nombre del contacto, o el nombre del cliente como fallback. */
function saludo(c: ReminderClient): string {
  const contacto = (c.contacto_nombre ?? "").trim();
  if (contacto) return contacto.split(/\s+/)[0];
  return c.nombre;
}

/**
 * Monto a cobrar este período. Aplica el descuento del contrato si está
 * cargado (el mensaje es editable, así que es un punto de partida).
 */
export function reminderAmount(c: ReminderClient): { monto: number; moneda: string } {
  const moneda = c.contrato_moneda || "ARS";
  const monto = applyContractDiscount(Number(c.monto_mensual ?? 0), c);
  return { monto, moneda };
}

/**
 * Mensaje de recordatorio de pago listo para mandar por WhatsApp, adaptado al
 * cliente y al período. Pago ideal: el 1° del mes.
 *
 * Sin emoji "astrales" (fuera del plano básico de Unicode, ej. 👋🚀🔹🙌):
 * WhatsApp Web los corrompe al precargar el texto desde el link wa.me
 * (aparecen como "�"). Usamos como mucho emoji simples (BMP) si hace falta.
 */
export function buildPaymentReminder(c: ReminderClient, periodo: string): string {
  const { monto, moneda } = reminderAmount(c);
  const mes = periodLabel(periodo); // ej. "junio de 2026"
  const montoTxt = monto > 0 ? fmtCurrency(monto, moneda) : "(monto a confirmar)";
  const { alias, nombre: banco, titular } = AGENCY.bank;

  return [
    `¡Hola ${saludo(c)}! Te escribo de ${AGENCY.brand}.`,
    ``,
    `Arrancamos con ${mes} y te paso el recordatorio de tu abono: *${montoTxt}*.`,
    ``,
    `Podés transferir a:`,
    `• Alias: *${alias}*`,
    `• ${banco} — ${titular}`,
    ``,
    `Cuando lo tengas, mandame el comprobante y seguimos a full con tu contenido. ¡Gracias!`,
  ].join("\n");
}

/**
 * Recordatorio ÚNICO para un titular que tiene varias cuentas (mismo teléfono).
 * Lista cada marca con su abono (ya con descuento) y el total sumado por moneda.
 * Ej.: "Marca A: $A · Marca B: $B · Total: $A+B".
 */
export function buildGroupedPaymentReminder(clients: ReminderClient[], periodo: string): string {
  if (clients.length === 1) return buildPaymentReminder(clients[0], periodo);

  const mes = periodLabel(periodo);
  const { alias, nombre: banco, titular } = AGENCY.bank;

  const items = clients.map((c) => ({ nombre: c.nombre, ...reminderAmount(c) }));

  // Total por moneda (por si alguna cuenta cobra en otra divisa).
  const totales = new Map<string, number>();
  for (const it of items) {
    if (it.monto > 0) totales.set(it.moneda, (totales.get(it.moneda) ?? 0) + it.monto);
  }
  const totalTxt = [...totales.entries()].map(([mon, v]) => fmtCurrency(v, mon)).join(" + ");

  const detalle = items.map(
    (it) =>
      `• ${it.nombre}: *${it.monto > 0 ? fmtCurrency(it.monto, it.moneda) : "(monto a confirmar)"}*`
  );

  const lines = [
    `¡Hola ${saludo(clients[0])}! Te escribo de ${AGENCY.brand}.`,
    ``,
    `Arrancamos con ${mes} y te paso el recordatorio de tus abonos:`,
    ...detalle,
  ];
  if (totalTxt) lines.push(`Total: *${totalTxt}*`);
  lines.push(
    ``,
    `Podés transferir a:`,
    `• Alias: *${alias}*`,
    `• ${banco} — ${titular}`,
    ``,
    `Cuando lo tengas, mandame el comprobante y seguimos a full con tu contenido. ¡Gracias!`
  );
  return lines.join("\n");
}

/**
 * Limpia un teléfono y antepone el código de Argentina (54) si hace falta.
 * Devuelve null si no queda un número usable. Best-effort (mismo criterio
 * para el link wa.me manual y el envío automático por la API de Meta).
 */
export function normalizePhone(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let digits = telefono.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (!digits.startsWith("54")) digits = "54" + digits;
  return digits;
}

/** Link wa.me con el mensaje pre-cargado. Devuelve null si no hay un teléfono usable. */
export function whatsappLink(telefono: string | null | undefined, mensaje: string): string | null {
  const digits = normalizePhone(telefono);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}
