/**
 * Agregación de resultados de Instagram para el REPORTE MENSUAL del cliente.
 * Toma los snapshots diarios del mes y devuelve los números que el cliente quiere
 * ver: seguidores totales, cuántos sumó en el mes, y el alcance / visitas al
 * perfil / interacciones de los últimos 28 días (el rollup que guarda el sync).
 *
 * Devuelve null en cada campo si no hay datos, para que el reporte caiga al valor
 * cargado a mano (la sección orgánica sigue editable para clientes sin IG conectado).
 */
import { createAdmin } from "@/lib/supabase/admin";
import type { IgMedia } from "@/lib/meta/instagram";

type Admin = ReturnType<typeof createAdmin>;

/**
 * Rango del mes como [primer día, primer día del mes siguiente) — exclusivo.
 * Evita armar fechas inválidas tipo "2026-06-31" (junio tiene 30 días), que
 * hacen fallar la consulta en Postgres (columna date).
 */
function monthRange(mes: string): { start: string; endExclusive: string } {
  const [y, m] = mes.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { start: `${mes}-01`, endExclusive: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

export interface IgMonthly {
  connected: boolean; // el cliente tiene cuenta de IG conectada
  hasData: boolean; // hay al menos un snapshot en el mes
  followersEnd: number | null; // seguidores al cierre del mes
  seguidoresNuevos: number | null; // delta de seguidores dentro del mes
  reach: number | null; // alcance (28 días) al cierre del mes
  profileViews: number | null; // visitas al perfil (28 días)
  interactions: number | null; // interacciones (28 días)
  media: IgMedia[]; // todo el feed publicado en el mes
}

interface SnapRow {
  fecha: string;
  followers: number;
  reach: number;
  profile_views: number;
  interactions: number;
  detalle: {
    month?: { reach?: number; profile_views?: number; interactions?: number };
    media?: IgMedia[];
  } | null;
}

const EMPTY: IgMonthly = {
  connected: false,
  hasData: false,
  followersEnd: null,
  seguidoresNuevos: null,
  reach: null,
  profileViews: null,
  interactions: null,
  media: [],
};

export interface IgStoryLite {
  story_id: string;
  media_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  reach: number | null;
  replies: number | null;
}

export interface IgStoriesMonthly {
  count: number;
  reach: number | null; // suma de alcance de las historias del mes
  replies: number | null; // suma de respuestas
  stories: IgStoryLite[];
}

/** Historias de IG capturadas en el mes. `mes` = YYYY-MM. */
export async function igStoriesForReport(
  admin: Admin,
  clienteId: string,
  mes: string
): Promise<IgStoriesMonthly> {
  const { start, endExclusive } = monthRange(mes);
  const { data } = await admin
    .from("ig_stories")
    .select("story_id, media_type, permalink, thumbnail_url, posted_at, reach, replies")
    .eq("cliente_id", clienteId)
    .gte("posted_at", start)
    .lt("posted_at", endExclusive)
    .order("posted_at", { ascending: false });
  const stories = (data ?? []) as IgStoryLite[];
  if (stories.length === 0) return { count: 0, reach: null, replies: null, stories: [] };
  let reach = 0;
  let replies = 0;
  let hasReach = false;
  let hasReplies = false;
  for (const s of stories) {
    if (s.reach != null) {
      reach += Number(s.reach);
      hasReach = true;
    }
    if (s.replies != null) {
      replies += Number(s.replies);
      hasReplies = true;
    }
  }
  return {
    count: stories.length,
    reach: hasReach ? reach : null,
    replies: hasReplies ? replies : null,
    stories,
  };
}

export interface PaidMonthly {
  hasData: boolean;
  moneda: string;
  spend: number;
  conversions: number;
  costPerConv: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
}

/** Agrega los snapshots diarios de paid media del mes. `mes` = YYYY-MM. */
export async function paidMonthlyForReport(
  admin: Admin,
  clienteId: string,
  mes: string
): Promise<PaidMonthly> {
  const { start, endExclusive } = monthRange(mes);
  const { data } = await admin
    .from("paid_media_snapshots")
    .select("spend, impressions, clicks, conversions, moneda")
    .eq("cliente_id", clienteId)
    .gte("fecha", start)
    .lt("fecha", endExclusive);
  const rows = (data ?? []) as {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    moneda: string;
  }[];
  const agg = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend),
      impressions: acc.impressions + Number(r.impressions),
      clicks: acc.clicks + Number(r.clicks),
      conversions: acc.conversions + Number(r.conversions),
      moneda: r.moneda || acc.moneda,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, moneda: "ARS" }
  );
  const hasData = rows.length > 0 && (agg.spend > 0 || agg.conversions > 0);
  return {
    hasData,
    moneda: agg.moneda,
    spend: agg.spend,
    conversions: agg.conversions,
    costPerConv: agg.conversions > 0 ? Math.round(agg.spend / agg.conversions) : null,
    impressions: agg.impressions,
    clicks: agg.clicks,
    ctr: agg.impressions > 0 ? Math.round((agg.clicks / agg.impressions) * 10000) / 100 : null,
  };
}

/** `mes` en formato YYYY-MM. */
export async function igMonthlyForReport(
  admin: Admin,
  clienteId: string,
  mes: string
): Promise<IgMonthly> {
  const { data: client } = await admin
    .from("clients")
    .select("ig_user_id")
    .eq("id", clienteId)
    .maybeSingle();
  const connected = !!(client as { ig_user_id?: string | null } | null)?.ig_user_id;

  const { start, endExclusive } = monthRange(mes);
  const { data } = await admin
    .from("ig_snapshots")
    .select("fecha, followers, reach, profile_views, interactions, detalle")
    .eq("cliente_id", clienteId)
    .gte("fecha", start)
    .lt("fecha", endExclusive)
    .order("fecha", { ascending: true });

  const rows = (data ?? []) as SnapRow[];
  if (rows.length === 0) return { ...EMPTY, connected };

  const first = rows[0];
  const last = rows[rows.length - 1];
  const month = last.detalle?.month ?? null;

  // El rollup de 28 días (detalle.month) a veces vuelve en 0 según la cuenta /
  // versión de la API. Si está vacío, caemos al mejor valor diario disponible
  // del mes (las columnas diarias del snapshot sí traen datos).
  const bestDaily = (key: "reach" | "profile_views" | "interactions"): number | null => {
    let max = 0;
    for (const r of rows) max = Math.max(max, Number(r[key] ?? 0));
    return max > 0 ? max : null;
  };
  const pick = (rollup: number | undefined, key: "reach" | "profile_views" | "interactions") =>
    rollup && rollup > 0 ? rollup : bestDaily(key);

  return {
    connected,
    hasData: true,
    followersEnd: last.followers,
    seguidoresNuevos: rows.length >= 2 ? last.followers - first.followers : null,
    reach: pick(month?.reach, "reach"),
    profileViews: pick(month?.profile_views, "profile_views"),
    interactions: pick(month?.interactions, "interactions"),
    media: last.detalle?.media ?? [],
  };
}
