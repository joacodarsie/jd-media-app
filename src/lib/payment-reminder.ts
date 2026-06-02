import { AGENCY } from "./agency";
import { fmtCurrency, periodLabel } from "./finanzas";

export interface ReminderClient {
  nombre: string;
  contacto_nombre?: string | null;
  monto_mensual?: number | null;
  contrato_moneda?: string | null;
  contrato_descuento_pct?: number | null;
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
  let monto = Number(c.monto_mensual ?? 0);
  const pct = Number(c.contrato_descuento_pct ?? 0);
  if (pct > 0 && pct < 100) monto = Math.round(monto * (1 - pct / 100));
  return { monto, moneda };
}

/**
 * Mensaje de recordatorio de pago listo para mandar por WhatsApp, adaptado al
 * cliente y al período. Pago ideal: el 1° del mes.
 */
export function buildPaymentReminder(c: ReminderClient, periodo: string): string {
  const { monto, moneda } = reminderAmount(c);
  const mes = periodLabel(periodo); // ej. "junio de 2026"
  const montoTxt = monto > 0 ? fmtCurrency(monto, moneda) : "(monto a confirmar)";
  const { alias, nombre: banco, titular } = AGENCY.bank;

  return [
    `¡Hola ${saludo(c)}! 👋 Te escribo de ${AGENCY.brand}.`,
    ``,
    `Arrancamos un nuevo mes 🚀 Te paso el recordatorio del abono de tu cuenta correspondiente a ${mes}: *${montoTxt}*.`,
    ``,
    `Para confirmarlo y seguir a full con tu contenido, podés transferir a:`,
    `🔹 Alias: *${alias}*`,
    `🔹 ${banco} — ${titular}`,
    ``,
    `Cuando lo tengas, pasame el comprobante y listo 🙌 ¡Gracias y a romperla este mes!`,
  ].join("\n");
}

/**
 * Link wa.me con el mensaje pre-cargado. Devuelve null si no hay un teléfono
 * usable. Best-effort: limpia el número y antepone el código de Argentina (54)
 * si hace falta.
 */
export function whatsappLink(telefono: string | null | undefined, mensaje: string): string | null {
  if (!telefono) return null;
  let digits = telefono.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (!digits.startsWith("54")) digits = "54" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}
