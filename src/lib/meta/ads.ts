/**
 * Cliente de la Meta Marketing API (Facebook/Instagram Ads).
 *
 * Auth: un token de System User del Business Manager de la agencia, con acceso a
 * las cuentas publicitarias de los clientes. Se guarda en la env
 * `META_SYSTEM_USER_TOKEN` (NO en la base). Cada cliente tiene su
 * `meta_ad_account_id` (formato act_XXXX) en client_ads_onboarding.
 *
 * Fase 1 = solo lectura (insights de cuenta y campañas). Fase 2 sumará escritura
 * (presupuestos, pausar/activar) con guardrails.
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

function normalizeAccount(id: string): string {
  const s = id.trim();
  return s.startsWith("act_") ? s : `act_${s}`;
}

export interface ResultAction {
  tipo: string; // etiqueta legible ("interacciones", "seguidores nuevos", "leads"…)
  valor: number;
  costo: number | null; // costo por resultado en la moneda de la cuenta
}

export interface AdMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number;
  cost_per_conversion: number | null;
  /**
   * TODOS los resultados relevantes de la campaña (no solo compras/leads):
   * interacciones, seguidores, clicks al link, reproducciones, mensajes, etc.
   * Es lo que evita decir "sin resultados" cuando el objetivo es interacción.
   */
  resultados: ResultAction[];
  moneda: string;
}

export interface CampaignMetrics extends AdMetrics {
  id: string;
  nombre: string;
  estado: string; // ACTIVE | PAUSED | ...
  objetivo: string | null;
  daily_budget: number | null; // en la moneda de la cuenta
}

export interface AdAccountData {
  account: AdMetrics;
  campaigns: CampaignMetrics[];
}

// Tipos de acción que contamos como "conversión" (de mayor a menor relevancia).
const CONVERSION_ACTION_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_complete_registration",
];

/**
 * Mapa action_type de Meta → etiqueta legible. Cubre los objetivos que NO son
 * compra/lead (interacción, seguidores, tráfico, video, mensajes), que antes
 * quedaban invisibles. Varios types caen en la misma etiqueta (se suman).
 */
const RESULT_ACTION_LABELS: Record<string, string> = {
  purchase: "compras",
  "offsite_conversion.fb_pixel_purchase": "compras",
  lead: "leads",
  "offsite_conversion.fb_pixel_lead": "leads",
  "onsite_conversion.lead_grouped": "leads",
  "offsite_conversion.fb_pixel_complete_registration": "registros",
  link_click: "clicks al link",
  landing_page_view: "vistas de landing",
  post_engagement: "interacciones",
  page_engagement: "interacciones",
  post_reaction: "reacciones",
  comment: "comentarios",
  post: "compartidos",
  like: "me gusta / seguidores de página",
  follow: "seguidores nuevos",
  "onsite_conversion.follow": "seguidores nuevos",
  video_view: "reproducciones de video",
  "onsite_conversion.messaging_conversation_started_7d": "conversaciones de WhatsApp/DM",
  "onsite_conversion.total_messaging_connection": "mensajes",
  landing_page_views: "vistas de landing",
};

/**
 * Junta TODOS los resultados relevantes (no solo compra/lead), agrupados por
 * etiqueta, con su costo por resultado. Ordenados por volumen. Así el análisis
 * ve que una campaña de interacción/seguidores SÍ dio resultado.
 */
function pickResultados(ins: RawInsight): ResultAction[] {
  const actions = ins.actions ?? [];
  const costs = ins.cost_per_action_type ?? [];
  const byLabel = new Map<string, { valor: number; costo: number | null }>();
  for (const a of actions) {
    const label = RESULT_ACTION_LABELS[a.action_type];
    if (!label) continue;
    const prev = byLabel.get(label) ?? { valor: 0, costo: null };
    prev.valor += num(a.value);
    if (prev.costo == null) {
      const c = costs.find((x) => x.action_type === a.action_type);
      if (c) prev.costo = num(c.value);
    }
    byLabel.set(label, prev);
  }
  return [...byLabel.entries()]
    .map(([tipo, v]) => ({ tipo, valor: v.valor, costo: v.costo }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);
}

interface RawInsight {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  account_currency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickConversions(ins: RawInsight): { conversions: number; cpa: number | null } {
  const actions = ins.actions ?? [];
  let conversions = 0;
  let usedType: string | null = null;
  for (const t of CONVERSION_ACTION_TYPES) {
    const a = actions.find((x) => x.action_type === t);
    if (a) {
      conversions += num(a.value);
      if (!usedType) usedType = t;
    }
  }
  let cpa: number | null = null;
  if (usedType) {
    const c = (ins.cost_per_action_type ?? []).find((x) => x.action_type === usedType);
    if (c) cpa = num(c.value);
  }
  return { conversions, cpa };
}

function toMetrics(ins: RawInsight): AdMetrics {
  const { conversions, cpa } = pickConversions(ins);
  return {
    spend: num(ins.spend),
    impressions: num(ins.impressions),
    reach: num(ins.reach),
    clicks: num(ins.clicks),
    ctr: ins.ctr != null ? num(ins.ctr) : null,
    cpc: ins.cpc != null ? num(ins.cpc) : null,
    cpm: ins.cpm != null ? num(ins.cpm) : null,
    conversions,
    cost_per_conversion:
      cpa != null ? cpa : conversions > 0 ? num(ins.spend) / conversions : null,
    resultados: pickResultados(ins),
    moneda: ins.account_currency ?? "ARS",
  };
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token() }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { cache: "no-store" });
  const json = (await res.json()) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || (json as { error?: unknown }).error) {
    const msg = json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(`META_API: ${msg}`);
  }
  return json;
}

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,ctr,cpc,cpm,account_currency,actions,cost_per_action_type";

/**
 * Trae métricas de la cuenta + por campaña para un período (default: ayer).
 * `datePreset`: yesterday | today | last_7d | last_30d | this_month | last_month.
 */
export async function fetchAdAccountData(
  adAccountId: string,
  datePreset = "yesterday"
): Promise<AdAccountData> {
  const acct = normalizeAccount(adAccountId);

  // Insights a nivel cuenta.
  const accRes = await graphGet<{ data: RawInsight[] }>(`${acct}/insights`, {
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
    level: "account",
  });
  const account = accRes.data?.[0] ? toMetrics(accRes.data[0]) : toMetrics({});

  // Campañas con sus insights (para el análisis y, a futuro, aplicar cambios).
  const campRes = await graphGet<{
    data: {
      id: string;
      name: string;
      status: string;
      objective?: string;
      daily_budget?: string;
      insights?: { data: RawInsight[] };
    }[];
  }>(`${acct}/campaigns`, {
    fields: `id,name,status,objective,daily_budget,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}`,
    limit: "50",
  });

  const campaigns: CampaignMetrics[] = (campRes.data ?? []).map((c) => {
    const m = c.insights?.data?.[0] ? toMetrics(c.insights.data[0]) : toMetrics({});
    return {
      ...m,
      id: c.id,
      nombre: c.name,
      estado: c.status,
      objetivo: c.objective ?? null,
      // daily_budget viene en centavos de la moneda de la cuenta.
      daily_budget: c.daily_budget != null ? num(c.daily_budget) / 100 : null,
    };
  });

  return { account, campaigns };
}

export interface AdSetMetrics extends AdMetrics {
  id: string;
  nombre: string;
  estado: string;
  campana: string | null;
  daily_budget: number | null;
}

/**
 * Trae los conjuntos de anuncios (ad sets) con sus métricas, para el análisis
 * profundo. Se llama solo on-demand (no consume tokens; es Meta API).
 */
export async function fetchAdSets(
  adAccountId: string,
  datePreset = "last_30d"
): Promise<AdSetMetrics[]> {
  const acct = normalizeAccount(adAccountId);
  const res = await graphGet<{
    data: {
      id: string;
      name: string;
      status: string;
      daily_budget?: string;
      campaign?: { name?: string };
      insights?: { data: RawInsight[] };
    }[];
  }>(`${acct}/adsets`, {
    fields: `id,name,status,daily_budget,campaign{name},insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}`,
    limit: "100",
  });
  return (res.data ?? []).map((s) => {
    const m = s.insights?.data?.[0] ? toMetrics(s.insights.data[0]) : toMetrics({});
    return {
      ...m,
      id: s.id,
      nombre: s.name,
      estado: s.status,
      campana: s.campaign?.name ?? null,
      daily_budget: s.daily_budget != null ? num(s.daily_budget) / 100 : null,
    };
  });
}

// ── Escritura (Fase 2: aplicar cambios) — requiere ads_management ──

async function graphPost(id: string, params: Record<string, string>): Promise<void> {
  const res = await fetch(`${GRAPH}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token() }).toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(`META_API: ${json.error?.message ?? `error ${res.status}`}`);
  }
}

/** Pausa o activa una campaña o conjunto (mismo endpoint por id). */
export async function setEntityStatus(id: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
  await graphPost(id, { status });
}

/**
 * Cambia el presupuesto diario de una campaña o conjunto. `dailyBudgetMajor` va
 * en la moneda de la cuenta (ej: 6000 = ARS 6.000); Meta lo espera en centavos.
 */
export async function setEntityDailyBudget(id: string, dailyBudgetMajor: number): Promise<void> {
  await graphPost(id, { daily_budget: String(Math.round(dailyBudgetMajor * 100)) });
}

/** Mensaje de error amable para mostrar en la UI. */
export function friendlyMetaError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("META_NO_TOKEN"))
    return "Falta conectar Meta: configurá el token del sistema (META_SYSTEM_USER_TOKEN).";
  if (msg.includes("META_API")) {
    if (/expired|session|OAuth|token/i.test(msg))
      return "El token de Meta expiró o no tiene permisos. Generá uno nuevo de System User.";
    return msg.replace("META_API: ", "Meta: ");
  }
  return "No se pudieron traer las métricas de Meta. Reintentá en un rato.";
}
