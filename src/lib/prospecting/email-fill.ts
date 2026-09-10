/**
 * Completar la columna `email` de los contactos a partir de su sitio web.
 *
 * Vive acá y no en la ruta porque lo usan dos: el botón "Buscar emails" de la
 * pantalla y el cron diario, que hace la cadena entera sin que nadie apriete
 * nada. No gasta tokens: baja el HTML del sitio y lee el mail publicado.
 *
 * OJO con el orden de la tanda. Antes se pedían 40 "con sitio y sin email" sin
 * `order`, y Postgres devolvía siempre los mismos 40 — todos sitios que no
 * publican el mail. El cron corría todos los días, encontraba cero, y el email
 * en frío quedó parado 35 días con 779 contactos que nunca se miraron. Ahora
 * cada contacto revisado queda marcado en `email_buscado_at`, así la tanda
 * avanza: primero los que nunca se miraron, después los más viejos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarEmailDeSitio, esSitioDeDirectorio } from "./email-finder";
import { esEmailValido, normalizarEmail } from "./cold-email";

/** Cuántos sitios visitar por tanda (el resto queda para la próxima corrida). */
export const TANDA_SITIOS = 40;
/** Sitios en paralelo. Más que esto empieza a dar timeouts en sitios lentos. */
export const CONCURRENCIA = 6;

export interface EmailsCompletados {
  revisados: number;
  encontrados: number;
  pendientes: number;
  /** Fichas de portales que se saltearon sin bajarlas. */
  salteados: number;
  error?: string;
}

interface ContactoASondear {
  id: string;
  sitio_web: string;
}

export async function completarEmails(
  admin: SupabaseClient,
  opts: { campaignId?: string; limite?: number } = {}
): Promise<EmailsCompletados> {
  const limite = opts.limite ?? TANDA_SITIOS;

  const traer = (ordenar: boolean) => {
    let q = admin
      .from("prospecting_contacts")
      .select("id, empresa, sitio_web, email")
      .not("sitio_web", "is", null)
      .is("email", null)
      .limit(limite);
    // nullsFirst: los que nunca se miraron van primero; después, el más viejo
    // (un sitio puede publicar el mail meses después de la primera pasada).
    if (ordenar) q = q.order("email_buscado_at", { ascending: true, nullsFirst: true });
    if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
    return q;
  };

  // La 0160 puede no estar aplicada todavía: si falta la columna, se sigue
  // como antes (sin rotación) en vez de no buscar nada.
  let conMarca = true;
  let { data, error } = await traer(true);
  if (error && (error as { code?: string }).code === "42703") {
    conMarca = false;
    ({ data, error } = await traer(false));
  }
  if (error) {
    return {
      revisados: 0,
      encontrados: 0,
      pendientes: 0,
      salteados: 0,
      error:
        (error as { code?: string }).code === "42703"
          ? "Falta aplicar la migración 0142 (columna email)."
          : error.message,
    };
  }

  const lista = (data ?? []) as ContactoASondear[];
  const ahora = new Date().toISOString();
  let encontrados = 0;
  let salteados = 0;
  const revisados: string[] = [];

  const marcarRevisado = async (id: string) => {
    revisados.push(id);
    // Se marca de a uno y no al final para que un timeout del cron no pierda
    // el avance de los que ya se bajaron.
    if (conMarca) {
      await admin.from("prospecting_contacts").update({ email_buscado_at: ahora }).eq("id", id);
    }
  };

  for (let i = 0; i < lista.length; i += CONCURRENCIA) {
    const tanda = lista.slice(i, i + CONCURRENCIA);
    await Promise.all(
      tanda.map(async (c) => {
        // La ficha en un portal no tiene el mail del negocio, pero sí el del
        // portal: bajarla es tiempo tirado y encima ensucia la lista.
        if (esSitioDeDirectorio(c.sitio_web)) {
          salteados++;
          await marcarRevisado(c.id);
          return;
        }
        const email = await buscarEmailDeSitio(c.sitio_web);
        if (!email || !esEmailValido(email)) {
          await marcarRevisado(c.id);
          return;
        }
        const { error: upErr } = await admin
          .from("prospecting_contacts")
          .update({ email: normalizarEmail(email), ...(conMarca ? { email_buscado_at: ahora } : {}) })
          .eq("id", c.id);
        if (upErr) return;
        encontrados++;
        revisados.push(c.id);
      })
    );
  }

  let cq = admin
    .from("prospecting_contacts")
    .select("id", { count: "exact", head: true })
    .not("sitio_web", "is", null)
    .is("email", null);
  if (opts.campaignId) cq = cq.eq("campaign_id", opts.campaignId);
  const { count } = await cq;

  return { revisados: revisados.length, encontrados, pendientes: count ?? 0, salteados };
}
