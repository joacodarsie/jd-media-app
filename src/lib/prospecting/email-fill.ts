/**
 * Completar la columna `email` de los contactos a partir de su sitio web.
 *
 * Vive acá y no en la ruta porque lo usan dos: el botón "Buscar emails" de la
 * pantalla y el cron diario, que hace la cadena entera sin que nadie apriete
 * nada. No gasta tokens: baja el HTML del sitio y lee el mail publicado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarEmailDeSitio } from "./email-finder";
import { esEmailValido, normalizarEmail } from "./cold-email";

/** Cuántos sitios visitar por tanda (el resto queda para la próxima corrida). */
export const TANDA_SITIOS = 40;
/** Sitios en paralelo. Más que esto empieza a dar timeouts en sitios lentos. */
export const CONCURRENCIA = 6;

export interface EmailsCompletados {
  revisados: number;
  encontrados: number;
  pendientes: number;
  error?: string;
}

export async function completarEmails(
  admin: SupabaseClient,
  opts: { campaignId?: string; limite?: number } = {}
): Promise<EmailsCompletados> {
  const limite = opts.limite ?? TANDA_SITIOS;

  let q = admin
    .from("prospecting_contacts")
    .select("id, empresa, sitio_web, email")
    .not("sitio_web", "is", null)
    .is("email", null)
    .limit(limite);
  if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);

  const { data, error } = await q;
  if (error) {
    return {
      revisados: 0,
      encontrados: 0,
      pendientes: 0,
      error:
        (error as { code?: string }).code === "42703"
          ? "Falta aplicar la migración 0142 (columna email)."
          : error.message,
    };
  }

  const lista = (data ?? []) as { id: string; sitio_web: string }[];
  let encontrados = 0;

  for (let i = 0; i < lista.length; i += CONCURRENCIA) {
    const tanda = lista.slice(i, i + CONCURRENCIA);
    await Promise.all(
      tanda.map(async (c) => {
        const email = await buscarEmailDeSitio(c.sitio_web);
        if (!email || !esEmailValido(email)) return;
        const { error: upErr } = await admin
          .from("prospecting_contacts")
          .update({ email: normalizarEmail(email) })
          .eq("id", c.id);
        if (!upErr) encontrados++;
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

  return { revisados: lista.length, encontrados, pendientes: count ?? 0 };
}
