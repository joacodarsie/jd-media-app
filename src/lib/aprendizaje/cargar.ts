/**
 * Qué funciona en una cuenta, contra Instagram (24/10/2026). Junta dos fuentes:
 *  - sus últimas 100 publicaciones públicas (business discovery desde la
 *    cuenta de JD Media), que sirven para cualquier cuenta de empresa;
 *  - las que guarda la conexión propia de la cuenta (ig_snapshots), que traen
 *    los me gusta aunque la cuenta los oculte al público.
 * Las analiza con `queFunciona`. Se guarda un día en caché: no cambia de una
 * hora a otra y cada consulta gasta cupo de la API de Meta.
 */
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { usuarioDe } from "@/lib/diagnostico/puntaje";
import { cuentaConHistorial } from "@/lib/diagnostico/instagram-publico";
import { hoyYmd } from "@/lib/dates";
import { queFunciona, type PostMedido, type QueFunciona } from "./que-funciona";

export type ResultadoQueFunciona = { ok: true; datos: QueFunciona; usuario: string } | { ok: false; motivo: string };

/** Las publicaciones que guarda la conexión propia de Instagram de la cuenta. */
async function postsPropios(clienteId: string): Promise<PostMedido[]> {
  const desde = new Date(Date.now() - 130 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await createAdmin()
    .from("ig_snapshots")
    .select("fecha, detalle")
    .eq("cliente_id", clienteId)
    .gte("fecha", desde)
    .order("fecha", { ascending: false })
    .limit(140);
  const vistos = new Map<string, PostMedido>();
  for (const s of (data ?? []) as { detalle: { media?: Record<string, unknown>[] } | null }[]) {
    for (const m of s.detalle?.media ?? []) {
      const k = String(m.permalink ?? m.id ?? "");
      if (!k || vistos.has(k) || !m.timestamp) continue;
      vistos.set(k, {
        timestamp: String(m.timestamp),
        likes: typeof m.like_count === "number" ? m.like_count : null,
        comentarios: typeof m.comments_count === "number" ? m.comments_count : null,
        tipo: String(m.media_type ?? "IMAGE"),
        // La API propia no siempre dice si un video es reel: hoy casi todos lo son.
        producto: (m.media_product_type as string | undefined) ?? (m.media_type === "VIDEO" ? "REELS" : "FEED"),
        permalink: (m.permalink as string | undefined) ?? null,
        imagen: ((m.thumbnail_url ?? m.media_url) as string | undefined) ?? null,
      });
    }
  }
  return [...vistos.values()];
}

/** Une las dos fuentes por link: si una no tiene los me gusta, vale la otra. */
function unir(publicos: PostMedido[], propios: PostMedido[]): PostMedido[] {
  const porLink = new Map<string, PostMedido>();
  for (const p of [...publicos, ...propios]) {
    const k = p.permalink ?? p.timestamp;
    const ya = porLink.get(k);
    if (!ya || (ya.likes == null && p.likes != null)) porLink.set(k, { ...p, imagen: p.imagen ?? ya?.imagen ?? null });
  }
  return [...porLink.values()];
}

async function calcular(clienteId: string): Promise<ResultadoQueFunciona> {
  const admin = createAdmin();
  const [{ data: c }, { data: base }] = await Promise.all([
    admin.from("clients").select("instagram_url").eq("id", clienteId).maybeSingle(),
    admin.from("clients").select("ig_user_id").not("ig_user_id", "is", null).ilike("nombre", "jd media").limit(1).maybeSingle(),
  ]);
  const usuario = (c as { instagram_url: string | null } | null)?.instagram_url ? usuarioDe((c as { instagram_url: string }).instagram_url) : null;
  if (!usuario) return { ok: false, motivo: "La cuenta no tiene cargado su Instagram en la ficha." };
  const desde = (base as { ig_user_id: string } | null)?.ig_user_id;
  const [publica, propios] = await Promise.all([
    desde ? cuentaConHistorial(desde, usuario, { paginasMax: 2 }).catch(() => null) : Promise.resolve(null),
    postsPropios(clienteId),
  ]);
  if (!publica && !propios.length)
    return { ok: false, motivo: `No pudimos leer @${usuario}: tiene que ser una cuenta de empresa o creador, y pública.` };
  return { ok: true, usuario, datos: queFunciona(unir(publica?.historial ?? [], propios), hoyYmd()) };
}

export function cargarQueFunciona(clienteId: string): Promise<ResultadoQueFunciona> {
  return unstable_cache(() => calcular(clienteId), ["que-funciona-v2", clienteId], { revalidate: 86_400 })();
}
