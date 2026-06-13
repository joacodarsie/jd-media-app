/**
 * Orquestación del sync de paid media: trae las métricas de Meta de un cliente,
 * guarda el snapshot diario y genera el análisis IA. Lo usan el botón manual
 * (acción) y el cron diario (dentro de due-notifications, para no sumar crons).
 */
import { createAdmin } from "@/lib/supabase/admin";
import { fetchAdAccountData, metaConfigured } from "@/lib/meta/ads";
import { generatePaidMediaAnalysis } from "./analysis";

type Admin = ReturnType<typeof createAdmin>;

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Sincroniza un cliente: métricas de AYER → snapshot → análisis IA.
 * Lanza si Meta falla (la acción lo traduce a mensaje amable).
 */
export async function syncClientPaidMedia(
  clienteId: string,
  opts?: { admin?: Admin; withAnalysis?: boolean }
): Promise<{ ok: true; spend: number; conversions: number } | { error: string }> {
  const admin = opts?.admin ?? createAdmin();

  const [{ data: client }, { data: ads }] = await Promise.all([
    admin.from("clients").select("id, nombre, rubro").eq("id", clienteId).maybeSingle(),
    admin
      .from("client_ads_onboarding")
      .select("meta_ad_account_id, campanas_notas")
      .eq("cliente_id", clienteId)
      .maybeSingle(),
  ]);

  if (!client) return { error: "Cliente no encontrado." };
  const adAccountId = (ads as { meta_ad_account_id?: string } | null)?.meta_ad_account_id;
  if (!adAccountId)
    return { error: "El cliente no tiene cuenta publicitaria de Meta cargada." };

  const data = await fetchAdAccountData(adAccountId, "yesterday");
  const a = data.account;
  const fecha = yesterdayISO();

  await admin.from("paid_media_snapshots").upsert(
    {
      cliente_id: clienteId,
      fecha,
      spend: a.spend,
      impressions: a.impressions,
      reach: a.reach,
      clicks: a.clicks,
      ctr: a.ctr,
      cpc: a.cpc,
      cpm: a.cpm,
      conversions: a.conversions,
      cost_per_conversion: a.cost_per_conversion,
      moneda: a.moneda,
      detalle: { campaigns: data.campaigns },
    },
    { onConflict: "cliente_id,fecha" }
  );

  if (opts?.withAnalysis !== false) {
    const { data: hist } = await admin
      .from("paid_media_snapshots")
      .select("fecha, spend, conversions, cpc")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: true })
      .limit(14);

    const analysis = await generatePaidMediaAnalysis({
      cliente: (client as { nombre: string }).nombre,
      rubro: (client as { rubro: string | null }).rubro ?? null,
      objetivo:
        (ads as { campanas_notas?: string | null } | null)?.campanas_notas ?? null,
      moneda: a.moneda,
      hoy: data,
      historial: (hist ?? []).map((h) => ({
        fecha: (h as { fecha: string }).fecha,
        spend: Number((h as { spend: number }).spend),
        conversions: Number((h as { conversions: number }).conversions),
        cpc: (h as { cpc: number | null }).cpc != null ? Number((h as { cpc: number }).cpc) : null,
      })),
    });

    if (analysis) {
      await admin.from("paid_media_analysis").upsert(
        {
          cliente_id: clienteId,
          fecha,
          resumen: analysis.resumen,
          sugerencias: analysis.sugerencias,
          metricas: { account: a },
        },
        { onConflict: "cliente_id,fecha" }
      );
    }
  }

  return { ok: true, spend: a.spend, conversions: a.conversions };
}

/**
 * Sync diario de TODAS las cuentas con Meta cargado. Lo llama el cron.
 * No-op si Meta no está configurado.
 */
export async function runPaidMediaDaily(): Promise<{
  skipped?: boolean;
  total?: number;
  ok?: number;
  failed?: number;
}> {
  if (!metaConfigured()) return { skipped: true };
  const admin = createAdmin();
  const { data } = await admin
    .from("client_ads_onboarding")
    .select("cliente_id, meta_ad_account_id")
    .not("meta_ad_account_id", "is", null);

  const rows = (data ?? []) as { cliente_id: string }[];
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await syncClientPaidMedia(r.cliente_id, { admin });
      ok++;
    } catch {
      failed++;
    }
  }
  return { total: rows.length, ok, failed };
}
