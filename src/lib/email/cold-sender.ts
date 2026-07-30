/**
 * Envío del email en frío: configuración, llamada a Resend y el lote diario.
 *
 * La decisión de A QUIÉN y CUÁNTO se toma en `lib/prospecting/cold-email.ts`
 * (puro y testeado). Acá está lo que toca red y base.
 *
 * Nada se manda si falta configuración: la app queda en "modo borrador", arma
 * la cola y la muestra, pero no envía. Así se puede preparar todo antes de
 * tener el dominio verificado.
 */
import { createAdmin } from "@/lib/supabase/admin";
import {
  armarEmail,
  filtrarDestinatarios,
  normalizarEmail,
  topeDelDia,
  type CierreEmail,
  type DatosRemitente,
} from "@/lib/prospecting/cold-email";
import { tokenDeBaja } from "@/lib/prospecting/cold-email-token";
import { mensajeElegido } from "@/lib/prospecting/shared";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Asunto por defecto. Corto y con la empresa adentro. */
export const ASUNTO_DEFAULT = "Una idea para [EMPRESA]";

export interface ColdEmailConfig {
  configurado: boolean;
  /** Qué falta para poder mandar, en criollo. */
  faltan: string[];
  from: string | null;
  replyTo: string | null;
  remitente: DatosRemitente;
  topeDiario: number;
  siteUrl: string;
}

export function coldEmailConfig(): ColdEmailConfig {
  const from = process.env.COLD_EMAIL_FROM?.trim() || null;
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const faltan: string[] = [];
  if (!apiKey) faltan.push("RESEND_API_KEY (la clave de Resend)");
  if (!from)
    faltan.push('COLD_EMAIL_FROM (ej: "Joaquín de JD Media <joaquin@tudominio.com>")');

  return {
    configurado: !!apiKey && !!from,
    faltan,
    from,
    replyTo: process.env.COLD_EMAIL_REPLY_TO?.trim() || null,
    remitente: {
      nombre: process.env.COLD_EMAIL_FIRMA?.trim() || "Joaquín Darsie",
      agencia: "JD Media",
      direccion: process.env.COLD_EMAIL_DIRECCION?.trim() || "Córdoba, Argentina",
    },
    topeDiario: Number(process.env.COLD_EMAIL_TOPE ?? 100) || 100,
  siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://jd-media-app.vercel.app",
  };
}

/** Secreto para firmar el link de baja. Solo servidor. */
export function bajaSecret(): string {
  return (
    process.env.COLD_EMAIL_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "jd-media-baja"
  );
}

export function urlDeBaja(email: string, cfg = coldEmailConfig()): string {
  return `${cfg.siteUrl}/baja/${tokenDeBaja(email, bajaSecret())}`;
}

/**
 * La oferta y los links que van al final del mail. Los edita el dueño desde la
 * pantalla; si falta la migración 0144 se devuelve vacío y el mail sale igual.
 */
export async function leerCierre(): Promise<CierreEmail | null> {
  try {
    const { data } = await createAdmin()
      .from("cold_email_settings")
      .select("oferta, codigo, web, instagram, whatsapp")
      .eq("id", true)
      .maybeSingle();
    return (data as CierreEmail | null) ?? null;
  } catch {
    return null;
  }
}

interface ResendOk {
  id: string;
}

/** Manda un mail. Devuelve el id del proveedor o tira con un error legible. */
export async function enviarEmail(input: {
  to: string;
  asunto: string;
  texto: string;
  html: string;
  cfg?: ColdEmailConfig;
}): Promise<ResendOk> {
  const cfg = input.cfg ?? coldEmailConfig();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !cfg.from) throw new Error("Falta configurar el envío de email.");

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [input.to],
      subject: input.asunto,
      text: input.texto,
      html: input.html,
      ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
      // Cabecera estándar de baja: los proveedores la usan para el botón
      // "cancelar suscripción" y baja muchísimo el riesgo de spam.
      headers: { "List-Unsubscribe": `<${urlDeBaja(input.to, cfg)}>` },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) {
    throw new Error(body.message || `Resend devolvió ${res.status}`);
  }
  return { id: body.id };
}

export interface LoteResultado {
  configurado: boolean;
  enviados: number;
  errores: number;
  tope: number;
  pendientes: number;
  detalle: string[];
}

/**
 * Manda el lote del día: agarra los envíos en estado "pendiente" programados
 * para hoy o antes, respetando el tope con warm-up. Idempotente: cada fila
 * pasa a "enviado" apenas sale, así una segunda corrida no duplica nada.
 */
export async function runColdEmailBatch(
  opts: { limite?: number } = {}
): Promise<LoteResultado> {
  const cfg = coldEmailConfig();
  const admin = createAdmin();
  const hoy = new Date().toISOString().slice(0, 10);

  const { count: historicos } = await admin
    .from("cold_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("estado", "enviado");

  const tope = Math.min(
    topeDelDia(historicos ?? 0, cfg.topeDiario),
    opts.limite ?? Number.MAX_SAFE_INTEGER
  );

  const { data: cola, error } = await admin
    .from("cold_email_sends")
    .select("id, email, asunto, cuerpo, contact_id")
    .eq("estado", "pendiente")
    .lte("programado_para", hoy)
    .order("created_at", { ascending: true })
    .limit(tope);

  if (error) {
    return {
      configurado: cfg.configurado,
      enviados: 0,
      errores: 0,
      tope,
      pendientes: 0,
      detalle: [
        (error as { code?: string }).code === "42P01"
          ? "Falta aplicar la migración 0142."
          : error.message,
      ],
    };
  }

  const filas = cola ?? [];
  if (!cfg.configurado) {
    return {
      configurado: false,
      enviados: 0,
      errores: 0,
      tope,
      pendientes: filas.length,
      detalle: [`Sin configurar: falta ${cfg.faltan.join(" y ")}. No se mandó nada.`],
    };
  }

  // La lista de bajas se relee acá: alguien puede haberse dado de baja
  // DESPUÉS de que su mail entró a la cola.
  const { data: bajas } = await admin.from("cold_email_optouts").select("email");
  const suprimidos = new Set((bajas ?? []).map((b) => normalizarEmail(b.email as string)));

  let enviados = 0;
  let errores = 0;
  const detalle: string[] = [];

  for (const fila of filas) {
    const email = normalizarEmail(fila.email as string);
    if (suprimidos.has(email)) {
      await admin
        .from("cold_email_sends")
        .update({ estado: "error", error: "Se dio de baja antes del envío" })
        .eq("id", fila.id);
      continue;
    }
    try {
      const { id } = await enviarEmail({
        to: email,
        asunto: fila.asunto as string,
        texto: fila.cuerpo as string,
        html: (fila.cuerpo as string)
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replaceAll("\n", "<br>")}</p>`)
          .join(""),
        cfg,
      });
      await admin
        .from("cold_email_sends")
        .update({ estado: "enviado", provider_id: id, enviado_at: new Date().toISOString() })
        .eq("id", fila.id);
      if (fila.contact_id) {
        await admin
          .from("prospecting_contacts")
          .update({ estado: "contactado", contactado_at: new Date().toISOString() })
          .eq("id", fila.contact_id)
          .eq("estado", "nuevo");
      }
      enviados++;
    } catch (e) {
      errores++;
      const msg = e instanceof Error ? e.message : "error desconocido";
      detalle.push(`${email}: ${msg}`);
      await admin
        .from("cold_email_sends")
        .update({ estado: "error", error: msg.slice(0, 300) })
        .eq("id", fila.id);
    }
  }

  const { count: quedan } = await admin
    .from("cold_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  return {
    configurado: true,
    enviados,
    errores,
    tope,
    pendientes: quedan ?? 0,
    detalle,
  };
}

/**
 * Arma la cola: toma los contactos con email que nunca recibieron nada y crea
 * un envío por cada uno. No manda: solo deja todo listo para el cron.
 */
export async function programarEnvios(input: {
  campaignId: string;
  asuntoPlantilla?: string;
  limite?: number;
}): Promise<{ programados: number; error?: string; sinEmail: number }> {
  const admin = createAdmin();
  const cfg = coldEmailConfig();

  const { data: camp } = await admin
    .from("prospecting_campaigns")
    .select("id, mensajes_plantilla")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (!camp) return { programados: 0, sinEmail: 0, error: "Campaña no encontrada." };

  const plantilla = mensajeElegido(
    (camp as { mensajes_plantilla?: Parameters<typeof mensajeElegido>[0] }).mensajes_plantilla
  );
  if (!plantilla)
    return {
      programados: 0,
      sinEmail: 0,
      error:
        "La campaña todavía no tiene mensaje. Generá los mensajes en la campaña y elegí cuál usar.",
    };

  const { data: contactos, error: cErr } = await admin
    .from("prospecting_contacts")
    .select("id, empresa, email, contacto_nombre, estado")
    .eq("campaign_id", input.campaignId);
  if (cErr) {
    return {
      programados: 0,
      sinEmail: 0,
      error:
        (cErr as { code?: string }).code === "42703"
          ? "Falta aplicar la migración 0142 (columna email)."
          : cErr.message,
    };
  }

  const [{ data: bajas }, { data: enviados }, cierre] = await Promise.all([
    admin.from("cold_email_optouts").select("email"),
    admin.from("cold_email_sends").select("email"),
    leerCierre(),
  ]);

  const destinatarios = filtrarDestinatarios(contactos ?? [], {
    bajas: (bajas ?? []).map((b) => b.email as string),
    yaEnviados: (enviados ?? []).map((e) => e.email as string),
  }).slice(0, input.limite ?? 2000);

  if (!destinatarios.length)
    return {
      programados: 0,
      sinEmail: (contactos ?? []).filter((c) => !c.email).length,
    };

  const filas = destinatarios.map((d) => {
    const mail = armarEmail({
      asuntoPlantilla: input.asuntoPlantilla?.trim() || ASUNTO_DEFAULT,
      cuerpoPlantilla: plantilla.texto,
      empresa: d.empresa,
      contacto: d.contacto_nombre,
      remitente: cfg.remitente,
      bajaUrl: urlDeBaja(d.email as string, cfg),
      cierre,
    });
    return {
      contact_id: d.id,
      campaign_id: input.campaignId,
      email: d.email as string,
      asunto: mail.asunto,
      cuerpo: mail.texto,
      estado: "pendiente",
    };
  });

  const { error: insErr } = await admin.from("cold_email_sends").insert(filas);
  if (insErr) {
    if ((insErr as { code?: string }).code === "42P01")
      return { programados: 0, sinEmail: 0, error: "Falta aplicar la migración 0142." };
    return { programados: 0, sinEmail: 0, error: insErr.message };
  }

  return {
    programados: filas.length,
    sinEmail: (contactos ?? []).filter((c) => !c.email).length,
  };
}
