/**
 * Cliente de la Instagram Graph API (resultados orgánicos de IG).
 *
 * Auth: el MISMO system user token del Business Manager que usa paid media
 * (`META_SYSTEM_USER_TOKEN`). Para que funcione, la cuenta de IG del cliente debe
 * ser Business/Creator, estar vinculada a una página de Facebook asignada al
 * system user, y el token debe tener los permisos:
 *   instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list
 *
 * Cada cliente guarda su `ig_user_id` (IG Business Account) en clients. Se puede
 * descubrir automáticamente con `listAvailableIgAccounts()` (lista las páginas del
 * system user y sus cuentas de IG vinculadas) o cargar a mano.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function metaConfigured(): boolean {
  return !!process.env.META_SYSTEM_USER_TOKEN;
}

function token(): string {
  const t = process.env.META_SYSTEM_USER_TOKEN;
  if (!t) throw new Error("META_NO_TOKEN");
  return t;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token() }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = json.error?.message ?? `Instagram API error (${res.status})`;
    throw new Error(`META_API: ${msg}`);
  }
  return json;
}

/** Intento "best effort": devuelve null si la llamada falla (métrica deprecada, etc.). */
async function graphGetSoft<T>(
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  try {
    return await graphGet<T>(path, params);
  } catch {
    return null;
  }
}

// ── Descubrimiento de cuentas ──────────────────────────────────────────────

export interface IgAccountOption {
  pageId: string;
  pageName: string;
  igUserId: string;
  igUsername: string | null;
  profilePicture: string | null;
}

/**
 * Lista las cuentas de Instagram Business vinculadas a las páginas que maneja el
 * system user. Sirve para conectar la cuenta de un cliente sin pegar el ID a mano.
 */
export async function listAvailableIgAccounts(): Promise<IgAccountOption[]> {
  const res = await graphGet<{
    data: {
      id: string;
      name: string;
      instagram_business_account?: {
        id: string;
        username?: string;
        profile_picture_url?: string;
      };
    }[];
  }>("me/accounts", {
    fields: "name,instagram_business_account{id,username,profile_picture_url}",
    limit: "200",
  });
  return (res.data ?? [])
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      pageId: p.id,
      pageName: p.name,
      igUserId: p.instagram_business_account!.id,
      igUsername: p.instagram_business_account!.username ?? null,
      profilePicture: p.instagram_business_account!.profile_picture_url ?? null,
    }));
}

// ── Métricas ────────────────────────────────────────────────────────────────

export interface IgProfile {
  username: string | null;
  name: string | null;
  followers: number;
  follows: number;
  media_count: number;
  profile_picture_url: string | null;
}

export interface IgRollup {
  reach: number;
  profile_views: number;
  interactions: number;
}

export interface IgMedia {
  id: string;
  caption: string | null;
  media_type: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  reach: number | null;
  saved: number | null;
}

export interface IgResults {
  profile: IgProfile;
  /** Métricas del día (ayer): para el snapshot diario. */
  day: IgRollup;
  /** Métricas acumuladas de los últimos 28 días: para el reporte mensual. */
  month: IgRollup;
  topMedia: IgMedia[];
}

/** Datos del perfil (seguidores, etc.) directo del nodo del usuario. */
export async function fetchIgProfile(igUserId: string): Promise<IgProfile> {
  const res = await graphGet<{
    username?: string;
    name?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    profile_picture_url?: string;
  }>(igUserId, {
    fields: "username,name,followers_count,follows_count,media_count,profile_picture_url",
  });
  return {
    username: res.username ?? null,
    name: res.name ?? null,
    followers: num(res.followers_count),
    follows: num(res.follows_count),
    media_count: num(res.media_count),
    profile_picture_url: res.profile_picture_url ?? null,
  };
}

interface RawInsightItem {
  name: string;
  period: string;
  values?: { value: number; end_time?: string }[];
  total_value?: { value?: number };
}

/** Lee el valor de una métrica tolerando los dos formatos de la API (time_series y total_value). */
function readInsight(items: RawInsightItem[], name: string): number {
  const it = items.find((i) => i.name === name);
  if (!it) return 0;
  if (it.total_value && typeof it.total_value.value === "number") return num(it.total_value.value);
  const vals = it.values ?? [];
  if (vals.length === 0) return 0;
  return num(vals[vals.length - 1]?.value);
}

/**
 * Trae un rollup (reach + visitas al perfil + interacciones) para un período.
 * `period`: "day" (último día) o "days_28" (últimos 28 días, para el reporte).
 * Robusto: cada grupo de métricas va en su propia llamada best-effort, así una
 * métrica deprecada no tira abajo todo el rollup.
 */
async function fetchIgRollup(igUserId: string, period: "day" | "days_28"): Promise<IgRollup> {
  // reach soporta time_series y total_value; pedimos total_value para que el
  // valor de days_28 sea único (alcance de personas únicas en el período).
  const reachRes = await graphGetSoft<{ data: RawInsightItem[] }>(`${igUserId}/insights`, {
    metric: "reach",
    period,
    metric_type: "total_value",
  });
  // Estas requieren metric_type=total_value en las versiones nuevas.
  const totalsRes = await graphGetSoft<{ data: RawInsightItem[] }>(`${igUserId}/insights`, {
    metric: "profile_views,total_interactions",
    period,
    metric_type: "total_value",
  });

  const reach = reachRes ? readInsight(reachRes.data ?? [], "reach") : 0;
  const totals = totalsRes?.data ?? [];
  return {
    reach,
    profile_views: readInsight(totals, "profile_views"),
    interactions: readInsight(totals, "total_interactions"),
  };
}

/** Top publicaciones del último ~mes, ordenadas por alcance. */
export async function fetchIgTopMedia(igUserId: string, limit = 12): Promise<IgMedia[]> {
  const res = await graphGetSoft<{
    data: {
      id: string;
      caption?: string;
      media_type?: string;
      permalink?: string;
      thumbnail_url?: string;
      media_url?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
      insights?: { data: RawInsightItem[] };
    }[];
  }>(`${igUserId}/media`, {
    fields:
      "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count,insights.metric(reach,saved){values}",
    limit: "25",
  });
  if (!res) return [];

  const cutoff = Date.now() - 35 * 86400_000; // últimos ~35 días
  const items = (res.data ?? [])
    .filter((m) => {
      if (!m.timestamp) return true;
      return new Date(m.timestamp).getTime() >= cutoff;
    })
    .map<IgMedia>((m) => {
      const ins = m.insights?.data ?? [];
      const reachIt = ins.find((i) => i.name === "reach");
      const savedIt = ins.find((i) => i.name === "saved");
      return {
        id: m.id,
        caption: m.caption?.trim() ? m.caption.trim() : null,
        media_type: m.media_type ?? "IMAGE",
        permalink: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        timestamp: m.timestamp ?? null,
        like_count: num(m.like_count),
        comments_count: num(m.comments_count),
        reach: reachIt ? num(reachIt.values?.[0]?.value) : null,
        saved: savedIt ? num(savedIt.values?.[0]?.value) : null,
      };
    });

  items.sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));
  return items.slice(0, limit);
}

/** Trae el paquete completo de resultados de IG de un cliente (para el sync). */
export async function fetchIgResults(igUserId: string): Promise<IgResults> {
  const [profile, day, month, topMedia] = await Promise.all([
    fetchIgProfile(igUserId),
    fetchIgRollup(igUserId, "day"),
    fetchIgRollup(igUserId, "days_28"),
    fetchIgTopMedia(igUserId),
  ]);
  return { profile, day, month, topMedia };
}

/** Mensaje de error amable para la UI. */
export function friendlyIgError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("META_NO_TOKEN"))
    return "Falta conectar Meta: configurá el token del sistema (META_SYSTEM_USER_TOKEN).";
  if (msg.includes("META_API")) {
    if (/permission|insights|scope|oauth|token|expired|session/i.test(msg))
      return "El token de Meta no tiene los permisos de Instagram (instagram_basic, instagram_manage_insights, pages_read_engagement). Regeneralo con esos permisos.";
    return msg.replace("META_API: ", "Instagram: ");
  }
  return "No se pudieron traer los resultados de Instagram. Reintentá en un rato.";
}
