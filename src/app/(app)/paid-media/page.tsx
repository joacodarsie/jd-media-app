import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta/ads";
import {
  PaidMediaPanel,
  type PaidClient,
  type PaidSuggestion,
} from "@/components/paid-media-panel";

export const dynamic = "force-dynamic";

export default async function PaidMediaPage() {
  await requireRole(["admin", "coordinador", "paid_media"]);
  const admin = createAdmin();

  // Clientes con servicio de pauta activo.
  const { data: svcRows } = await admin
    .from("client_services")
    .select("cliente_id")
    .eq("tipo", "paid_media")
    .eq("activo", true);
  const clienteIds = Array.from(
    new Set(((svcRows ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id))
  );

  if (clienteIds.length === 0) {
    return (
      <div className="space-y-5">
        <Header configured={metaConfigured()} />
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay clientes con servicio de pauta activo.
        </p>
      </div>
    );
  }

  const [{ data: clientsRaw }, { data: adsRaw }, { data: snapsRaw }, { data: anaRaw }] =
    await Promise.all([
      admin.from("clients").select("id, nombre").in("id", clienteIds),
      admin
        .from("client_ads_onboarding")
        .select("cliente_id, meta_ad_account_id")
        .in("cliente_id", clienteIds),
      admin
        .from("paid_media_snapshots")
        .select(
          "cliente_id, fecha, spend, impressions, reach, clicks, ctr, cpc, cpm, conversions, cost_per_conversion, moneda"
        )
        .in("cliente_id", clienteIds)
        .order("fecha", { ascending: false }),
      admin
        .from("paid_media_analysis")
        .select("cliente_id, fecha, resumen, sugerencias")
        .in("cliente_id", clienteIds)
        .order("fecha", { ascending: false }),
    ]);

  const clients = (clientsRaw ?? []) as { id: string; nombre: string }[];
  const adById = new Map(
    ((adsRaw ?? []) as { cliente_id: string; meta_ad_account_id: string | null }[]).map(
      (a) => [a.cliente_id, a.meta_ad_account_id]
    )
  );

  // Primer snapshot/análisis por cliente (ya vienen ordenados desc por fecha).
  const latestSnap = new Map<string, Record<string, unknown>>();
  for (const s of (snapsRaw ?? []) as Record<string, unknown>[]) {
    const id = s.cliente_id as string;
    if (!latestSnap.has(id)) latestSnap.set(id, s);
  }
  const latestAna = new Map<string, Record<string, unknown>>();
  for (const a of (anaRaw ?? []) as Record<string, unknown>[]) {
    const id = a.cliente_id as string;
    if (!latestAna.has(id)) latestAna.set(id, a);
  }

  const paidClients: PaidClient[] = clients
    .map((c) => {
      const s = latestSnap.get(c.id);
      const a = latestAna.get(c.id);
      return {
        id: c.id,
        nombre: c.nombre,
        adAccountId: adById.get(c.id) ?? null,
        snapshot: s
          ? {
              fecha: s.fecha as string,
              spend: Number(s.spend),
              impressions: Number(s.impressions),
              clicks: Number(s.clicks),
              ctr: s.ctr != null ? Number(s.ctr) : null,
              cpc: s.cpc != null ? Number(s.cpc) : null,
              conversions: Number(s.conversions),
              cost_per_conversion:
                s.cost_per_conversion != null ? Number(s.cost_per_conversion) : null,
              moneda: (s.moneda as string) ?? "ARS",
            }
          : null,
        analysis: a
          ? {
              fecha: a.fecha as string,
              resumen: (a.resumen as string) ?? "",
              sugerencias: Array.isArray(a.sugerencias)
                ? (a.sugerencias as PaidSuggestion[])
                : [],
            }
          : null,
      };
    })
    .sort((x, y) => x.nombre.localeCompare(y.nombre));

  return (
    <div className="space-y-5">
      <Header configured={metaConfigured()} />
      <PaidMediaPanel clients={paidClients} metaConfigured={metaConfigured()} />
    </div>
  );
}

function Header({ configured }: { configured: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Paid Media</h1>
      <p className="text-muted-foreground">
        Métricas de las campañas de Meta de cada cliente, con análisis diario y
        sugerencias de mejora generadas por IA. El detalle del mes se integra al
        reporte mensual.
      </p>
      {!configured && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Falta conectar Meta.</strong> Configurá la variable{" "}
          <code>META_SYSTEM_USER_TOKEN</code> en Vercel (token de System User del
          Business Manager con acceso a las cuentas publicitarias) y cargá el ID
          de cuenta de cada cliente abajo.
        </div>
      )}
    </div>
  );
}
