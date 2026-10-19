/**
 * Trae las publicaciones de las fuentes de inspiración de una cuenta (0207).
 * - Cuenta de referencia: sus últimas 50 publicaciones (varios meses) por
 *   business discovery; el rendimiento se mide contra la mediana de esa cuenta.
 * - Hashtag del rubro: las publicaciones top del hashtag (necesita el permiso
 *   de contenido público de Meta; si no está, queda el error en la fuente).
 * Se actualiza sola una vez por semana desde el cron, o a mano con el botón.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { conRendimiento, formatoDe, type MediaCruda } from "./inspo";

const GRAPH = "https://graph.facebook.com/v21.0";
const CAMPOS = "id,permalink,caption,media_type,media_product_type,timestamp,like_count,comments_count,media_url,thumbnail_url";

export interface Fuente {
  id: string;
  cliente_id: string;
  tipo: "cuenta" | "hashtag";
  valor: string;
}

export async function igDeJdMedia(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("clients").select("ig_user_id").not("ig_user_id", "is", null).ilike("nombre", "jd media").limit(1).maybeSingle();
  return (data as { ig_user_id: string } | null)?.ig_user_id ?? null;
}

export async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new Error("Falta la conexión con Meta.");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (json.error) throw new Error(json.error.message ?? `Meta respondió ${res.status}`);
  return json;
}

export async function traerFuente(desde: string, f: Fuente): Promise<{ media: MediaCruda[]; cuenta: string | null; seguidores: number | null }> {
  if (f.tipo === "cuenta") {
    const r = await graph<{ business_discovery?: { username: string; followers_count?: number; media?: { data?: MediaCruda[] } } }>(desde, {
      fields: `business_discovery.username(${f.valor}){username,followers_count,media.limit(50){${CAMPOS}}}`,
    });
    const bd = r.business_discovery;
    if (!bd) throw new Error("No encontramos esa cuenta (tiene que ser pública y de empresa o creador).");
    return { media: bd.media?.data ?? [], cuenta: bd.username, seguidores: bd.followers_count ?? null };
  }
  const h = await graph<{ data?: { id: string }[] }>("ig_hashtag_search", { user_id: desde, q: f.valor });
  const tag = h.data?.[0]?.id;
  if (!tag) throw new Error("No encontramos ese hashtag.");
  const top = await graph<{ data?: MediaCruda[] }>(`${tag}/top_media`, { user_id: desde, fields: CAMPOS.replace(",thumbnail_url", ""), limit: "50" });
  return { media: top.data ?? [], cuenta: null, seguidores: null };
}

export async function actualizarFuentes(admin: SupabaseClient, fuentes: Fuente[]): Promise<{ ok: number; errores: string[] }> {
  const r = { ok: 0, errores: [] as string[] };
  if (!fuentes.length) return r;
  const desde = await igDeJdMedia(admin);
  if (!desde) return { ok: 0, errores: ["La cuenta de JD Media no tiene Instagram conectado."] };
  for (const f of fuentes) {
    try {
      const { media, cuenta, seguidores } = await traerFuente(desde, f);
      const filas = conRendimiento(media).map((m) => ({
        cliente_id: f.cliente_id,
        fuente_id: f.id,
        media_id: m.id,
        cuenta: cuenta ?? `#${f.valor}`,
        seguidores,
        permalink: m.permalink ?? null,
        caption: (m.caption ?? "").slice(0, 2000) || null,
        media_type: m.media_type ?? null,
        producto: formatoDe(m),
        publicado_at: m.timestamp ?? null,
        likes: m.like_count ?? null,
        comentarios: m.comments_count ?? null,
        imagen: m.thumbnail_url ?? m.media_url ?? null,
        rendimiento: m.rendimiento,
      }));
      if (filas.length) await admin.from("inspo_piezas").upsert(filas, { onConflict: "cliente_id,media_id" });
      await admin.from("inspo_fuentes").update({ ultimo_fetch: new Date().toISOString(), error: null }).eq("id", f.id);
      r.ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo traer.";
      await admin.from("inspo_fuentes").update({ ultimo_fetch: new Date().toISOString(), error: msg.slice(0, 300) }).eq("id", f.id);
      r.errores.push(`${f.tipo === "cuenta" ? "@" : "#"}${f.valor}: ${msg}`);
    }
  }
  return r;
}

/** Cron: las fuentes que no se actualizan hace una semana, de a poco (límite de Meta). */
export async function runInspoSemanal(admin: SupabaseClient, max = 30) {
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await admin
    .from("inspo_fuentes")
    .select("id, cliente_id, tipo, valor")
    .or(`ultimo_fetch.is.null,ultimo_fetch.lt.${hace7}`)
    .order("ultimo_fetch", { ascending: true, nullsFirst: true })
    .limit(max);
  return actualizarFuentes(admin, (data ?? []) as Fuente[]);
}
