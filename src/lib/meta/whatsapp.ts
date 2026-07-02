/**
 * Envío de mensajes de plantilla por la WhatsApp Business Platform (Meta Cloud
 * API). Reusa el token de System User del Business Manager de la agencia
 * (`META_SYSTEM_USER_TOKEN`, el mismo de Ads/Instagram) con permisos
 * `whatsapp_business_messaging` sumados. Requiere además:
 *   - `WHATSAPP_PHONE_NUMBER_ID`: el Phone Number ID del número de JD Media
 *     conectado por coexistencia en WhatsApp Manager.
 *   - Una plantilla ("template") categoría UTILITY aprobada por Meta. Nombre e
 *     idioma configurables por env (`WHATSAPP_TEMPLATE_RECORDATORIO`,
 *     `WHATSAPP_TEMPLATE_LANG`), con default al nombre que se dejó pedido para
 *     aprobación: "recordatorio_pago_mensual" / es_AR.
 *
 * Mientras no esté configurado, `whatsappApiConfigured()` da false y el cron
 * de recordatorios no manda nada (no rompe, solo lo salta).
 */

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_RECORDATORIO ?? "recordatorio_pago_mensual";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "es_AR";

export function whatsappApiConfigured(): boolean {
  return !!process.env.META_SYSTEM_USER_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
}

function token(): string {
  const t = process.env.META_SYSTEM_USER_TOKEN;
  if (!t) throw new Error("META_NO_TOKEN");
  return t;
}

function phoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_NO_PHONE_NUMBER_ID");
  return id;
}

/** Variables del body de la plantilla "recordatorio_pago_mensual" (en orden). */
export interface PaymentReminderTemplateVars {
  /** Dígitos con código de país, sin '+' (ver `normalizePhone` en payment-reminder.ts). */
  telefono: string;
  nombre: string;
  /** Ej "julio 2026". */
  mes: string;
  /** Ej "$300.000". */
  montoTxt: string;
  alias: string;
  /** Ej "Naranja X — Franco Joaquín Darsie". */
  bancoTitular: string;
}

export async function sendPaymentReminderTemplate(
  v: PaymentReminderTemplateVars
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: v.telefono,
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: v.nombre },
                { type: "text", text: v.mes },
                { type: "text", text: v.montoTxt },
                { type: "text", text: v.alias },
                { type: "text", text: v.bancoTitular },
              ],
            },
          ],
        },
      }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `Error ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
