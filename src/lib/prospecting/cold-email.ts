/**
 * Email en frío: armado del mensaje, lista de supresión y ritmo de envío.
 *
 * Todo lo que decide algo vive acá y es puro (se testea sin red ni base). El
 * envío en sí está en `lib/email/resend.ts` y la orquestación en el cron.
 *
 * Tres reglas que NO son opcionales, por eso están en el código y no en un
 * instructivo:
 *  1. Todo mail lleva quién lo manda, de dónde salió el contacto y un link de
 *     baja de un clic. Sin eso es spam y quema el dominio.
 *  2. A quien se dio de baja no se le escribe nunca más (lista de supresión).
 *  3. El volumen sube de a poco. Un dominio nuevo que manda 500 mails el primer
 *     día va derecho a spam y no se recupera: ver `topeDelDia`.
 */
import { personalizarMensaje } from "./shared";

export interface DatosRemitente {
  /** Cómo firma: "Joaquín Darsie". */
  nombre: string;
  /** Nombre de la agencia, para el pie. */
  agencia: string;
  /** Dirección física o ciudad: requisito legal del email comercial. */
  direccion: string;
}

/**
 * El cierre del mail: la oferta y por dónde contestar.
 *
 * El código de descuento no es marketing: es la ÚNICA forma de saber cuántos
 * clientes salió el canal. Quien escribe mencionándolo vino del mail, y eso se
 * puede contar contra lo que costó mandarlos.
 */
export interface CierreEmail {
  oferta?: string | null;
  codigo?: string | null;
  web?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
}

/** Arma el bloque de oferta + links. Vacío si no hay nada cargado. */
export function armarCierre(c: CierreEmail | null | undefined): string {
  if (!c) return "";
  const lineas: string[] = [];
  if (c.oferta?.trim()) {
    const codigo = c.codigo?.trim();
    lineas.push(
      codigo
        ? `${c.oferta.trim()} si me escribís mencionando ${codigo}.`
        : `${c.oferta.trim()}.`
    );
  }
  const contacto: string[] = [];
  if (c.whatsapp?.trim()) contacto.push(`WhatsApp: ${c.whatsapp.trim()}`);
  if (c.instagram?.trim()) contacto.push(`Instagram: ${normalizarIg(c.instagram)}`);
  if (c.web?.trim()) contacto.push(`Web: ${c.web.trim()}`);
  if (contacto.length) lineas.push(contacto.join(" · "));
  return lineas.join("\n");
}

/** "jdmedia" / "@jdmedia" / la URL completa → un @handle legible. */
function normalizarIg(valor: string): string {
  const v = valor.trim();
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  const handle = (m ? m[1] : v).replace(/^@/, "");
  return `@${handle}`;
}

export interface EmailArmado {
  asunto: string;
  texto: string;
  html: string;
}

/** Normaliza para comparar y guardar: sin espacios, en minúscula. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function esEmailValido(email: string): boolean {
  const e = normalizarEmail(email);
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 254;
}

/**
 * Asunto corto y concreto. Nada de "Propuesta de marketing digital": el asunto
 * genérico es lo primero que manda un mail en frío a la papelera.
 */
export function armarAsunto(plantilla: string, empresa: string): string {
  const a = personalizarMensaje(plantilla, { empresa }).replace(/\s+/g, " ").trim();
  return a.slice(0, 120);
}

function escaparHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Arma el mail completo (texto y HTML) con el pie legal y la baja.
 * El cuerpo sale de la misma plantilla de la campaña que se usa en WhatsApp:
 * una sola fuente de verdad para el mensaje.
 */
export function armarEmail(input: {
  asuntoPlantilla: string;
  cuerpoPlantilla: string;
  empresa: string;
  contacto?: string | null;
  remitente: DatosRemitente;
  bajaUrl: string;
  cierre?: CierreEmail | null;
}): EmailArmado {
  const asunto = armarAsunto(input.asuntoPlantilla, input.empresa);
  const base = personalizarMensaje(input.cuerpoPlantilla, {
    empresa: input.empresa,
    contacto: input.contacto,
  }).trim();
  const bloqueCierre = armarCierre(input.cierre);
  const cuerpo = bloqueCierre ? `${base}\n\n${bloqueCierre}` : base;

  const firma = `${input.remitente.nombre}\n${input.remitente.agencia}`;
  const pie =
    `Te escribo a la dirección que ${input.empresa} publica en su sitio. ` +
    `Si no querés recibir más mensajes, respondé "baja" o entrá acá: ${input.bajaUrl}\n` +
    `${input.remitente.agencia} — ${input.remitente.direccion}`;

  const texto = `${cuerpo}\n\n${firma}\n\n—\n${pie}`;

  const parrafos = cuerpo
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escaparHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("");

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">` +
    parrafos +
    `<p style="margin:0 0 12px">${escaparHtml(input.remitente.nombre)}<br>${escaparHtml(input.remitente.agencia)}</p>` +
    `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">` +
    `<p style="font-size:12px;color:#666;margin:0">` +
    `Te escribo a la dirección que ${escaparHtml(input.empresa)} publica en su sitio. ` +
    `Si no querés recibir más mensajes, <a href="${input.bajaUrl}">date de baja acá</a>.<br>` +
    `${escaparHtml(input.remitente.agencia)} — ${escaparHtml(input.remitente.direccion)}` +
    `</p></div>`;

  return { asunto, texto, html };
}

// El token firmado de la baja vive en `cold-email-token.ts` (usa node:crypto y
// este módulo lo importa también el editor del mail, que corre en el navegador).

// ── A quién se le manda ──────────────────────────────────────────────────────

export interface DestinatarioPosible {
  id: string;
  empresa: string;
  email: string | null;
  contacto_nombre?: string | null;
  estado?: string | null;
}

/**
 * Filtra la lista de contactos y deja solo los que se pueden mandar:
 * con email válido, no dados de baja, no escritos antes y no descartados.
 */
export function filtrarDestinatarios(
  contactos: DestinatarioPosible[],
  opts: { bajas?: Iterable<string>; yaEnviados?: Iterable<string> } = {}
): DestinatarioPosible[] {
  const bajas = new Set([...(opts.bajas ?? [])].map(normalizarEmail));
  const enviados = new Set([...(opts.yaEnviados ?? [])].map(normalizarEmail));
  const vistos = new Set<string>();
  const out: DestinatarioPosible[] = [];
  for (const c of contactos) {
    if (!c.email || !esEmailValido(c.email)) continue;
    const email = normalizarEmail(c.email);
    if (bajas.has(email) || enviados.has(email) || vistos.has(email)) continue;
    if (c.estado === "descartado") continue;
    vistos.add(email);
    out.push({ ...c, email });
  }
  return out;
}

/**
 * Cuántos mandar hoy según cuántos se mandaron en total desde este dominio.
 *
 * Es "warm-up": los proveedores miran el salto de volumen de un remitente nuevo.
 * Arrancar en 25 y subir es la diferencia entre entrar a la bandeja o a spam, y
 * spam quema el dominio para siempre. `tope` es el techo que fija el usuario.
 */
export function topeDelDia(enviadosHistoricos: number, tope = 100): number {
  const escalon =
    enviadosHistoricos < 50 ? 25 : enviadosHistoricos < 200 ? 50 : enviadosHistoricos < 500 ? 100 : 150;
  return Math.max(1, Math.min(escalon, tope));
}

/** Cuántos días de envío hacen falta para cubrir N contactos con el warm-up. */
export function diasParaCubrir(pendientes: number, tope = 100): number {
  let enviados = 0;
  let dias = 0;
  while (enviados < pendientes && dias < 365) {
    enviados += topeDelDia(enviados, tope);
    dias++;
  }
  return dias;
}
