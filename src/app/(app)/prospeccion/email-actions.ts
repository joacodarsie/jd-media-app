"use server";

import { revalidatePath } from "next/cache";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  coldEmailConfig,
  enviarEmail,
  programarEnvios,
  runColdEmailBatch,
} from "@/lib/email/cold-sender";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

async function ensureComercial(): Promise<string | null> {
  const me = await requireUser();
  return userInRoles(me, ROLES_OK)
    ? null
    : "No tenés acceso a prospección.";
}

/** Arma la cola de envíos de una campaña (no manda nada todavía). */
export async function programarEnviosDeCampana(campaignId: string, asunto?: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const res = await programarEnvios({ campaignId, asuntoPlantilla: asunto });
  revalidatePath("/prospeccion/email");
  return res;
}

/**
 * Manda el lote de ahora mismo sin esperar al cron. Sirve para la primera
 * corrida (y para probar): respeta el mismo tope diario con warm-up.
 */
export async function enviarLoteAhora() {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const res = await runColdEmailBatch();
  revalidatePath("/prospeccion/email");
  return res;
}

/**
 * Se manda UN mail de prueba a la casilla del que aprieta el botón.
 *
 * Existe porque hasta ahora la única forma de saber si el envío estaba bien
 * configurado era mandarle a un lead de verdad: si el dominio, la clave o el
 * remitente estaban mal, el primero en enterarse era el prospecto. Usa
 * exactamente el mismo camino que los mails reales (mismo remitente, mismo
 * Reply-To, misma cabecera de baja), así lo que se ve en la prueba es lo que
 * le va a llegar al lead.
 */
export async function enviarPrueba() {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const me = await requireUser();

  const cfg = coldEmailConfig();
  if (!cfg.configurado) return { error: `Falta configurar: ${cfg.faltan.join(", ")}` };

  // Va al Reply-To antes que al mail del usuario: el Reply-To es la casilla que
  // de verdad se lee (los mails del equipo son solo el usuario de la app y no
  // reciben nada). Así la prueba verifica el envío Y el reenvío, de una.
  const to = cfg.replyTo || me.email;
  if (!to) return { error: "No hay a dónde mandar la prueba: falta COLD_EMAIL_REPLY_TO." };

  const texto = [
    "Este es un mail de prueba del envío en frío de JD Media.",
    "",
    "Si lo estás leyendo, el dominio está verificado y la clave de Resend anda.",
    "Respondelo: la respuesta tiene que llegarte a la misma casilla donde recibís",
    `lo de ${cfg.replyTo ?? "tu dominio"}. Si no vuelve, el Reply-To está mal.`,
    "",
    "— JD Media",
  ].join("\n");

  try {
    const r = await enviarEmail({
      to,
      asunto: "Prueba de envío · JD Media",
      texto,
      html: `<p>${texto.replace(/\n/g, "<br>")}</p>`,
      cfg,
    });
    return { ok: true, id: r.id, to, replyTo: cfg.replyTo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo mandar." };
  }
}

/** Saca de la cola los envíos pendientes de una campaña (por si se arrepiente). */
export async function cancelarPendientes(campaignId: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const { error, count } = await createAdmin()
    .from("cold_email_sends")
    .delete({ count: "exact" })
    .eq("campaign_id", campaignId)
    .eq("estado", "pendiente");
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/email");
  return { cancelados: count ?? 0 };
}

/** Guarda la oferta y los links que van al final de todos los mails. */
export async function guardarCierre(input: {
  oferta: string;
  codigo: string;
  web: string;
  instagram: string;
  whatsapp: string;
}) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const limpio = (v: string) => v.trim().slice(0, 200) || null;
  const { error } = await createAdmin()
    .from("cold_email_settings")
    .upsert(
      {
        id: true,
        oferta: limpio(input.oferta),
        codigo: limpio(input.codigo),
        web: limpio(input.web),
        instagram: limpio(input.instagram),
        whatsapp: limpio(input.whatsapp),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) {
    if ((error as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0144." };
    return { error: error.message };
  }

  // Se guardan también en la ficha de la agencia: son LOS datos de JD Media, no
  // datos "del email". Así el resto de la app los tiene sin volver a pedirlos.
  const patch: Record<string, string> = {};
  if (input.whatsapp.trim()) patch.contacto_telefono = input.whatsapp.trim();
  if (input.instagram.trim()) patch.instagram_url = igUrl(input.instagram);
  if (input.web.trim()) patch.web_url = conProtocolo(input.web);
  if (Object.keys(patch).length) {
    await createAdmin().from("clients").update(patch).eq("es_interno", true);
  }

  revalidatePath("/prospeccion/email");
  return { ok: true as const };
}

function conProtocolo(url: string): string {
  const v = url.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function igUrl(valor: string): string {
  const v = valor.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}

/** Agrega una dirección a la lista de supresión a mano. */
export async function agregarBaja(email: string) {
  const gate = await ensureComercial();
  if (gate) return { error: gate };
  const limpio = email.trim().toLowerCase();
  if (!limpio.includes("@")) return { error: "No parece un email." };
  const { error } = await createAdmin()
    .from("cold_email_optouts")
    .upsert({ email: limpio, motivo: "cargado a mano" }, { onConflict: "email" });
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/email");
  return { ok: true as const };
}
