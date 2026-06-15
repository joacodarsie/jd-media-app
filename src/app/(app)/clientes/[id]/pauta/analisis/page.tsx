import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingUp, AlertTriangle } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta/ads";
import { PaidMediaChat } from "@/components/paid-media-chat";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "paid_media"];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function PaidMediaAnalisisPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  if (!isStaff(me.rol) && !ALLOWED.includes(me.rol)) notFound();

  const admin = createAdmin();
  const [{ data: client }, { data: ads }, { data: snap }] = await Promise.all([
    admin.from("clients").select("id, nombre").eq("id", params.id).maybeSingle(),
    admin
      .from("client_ads_onboarding")
      .select("meta_ad_account_id")
      .eq("cliente_id", params.id)
      .maybeSingle(),
    admin
      .from("paid_media_snapshots")
      .select("fecha, spend, clicks, ctr, cpc, conversions, cost_per_conversion, moneda")
      .eq("cliente_id", params.id)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!client) notFound();
  const adAccountId = (ads as { meta_ad_account_id?: string | null } | null)?.meta_ad_account_id ?? null;
  const s = snap as
    | {
        fecha: string;
        spend: number;
        clicks: number;
        ctr: number | null;
        cpc: number | null;
        conversions: number;
        cost_per_conversion: number | null;
        moneda: string;
      }
    | null;
  const moneda = s?.moneda ?? "ARS";
  const fmt = (n: number) => Number(n).toLocaleString("es-AR");

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/clientes/${client.id}`}
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> {(client as { nombre: string }).nombre}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrendingUp className="h-6 w-6 text-primary" /> Análisis & IA de pauta
        </h1>
        <p className="text-muted-foreground">
          Una IA dedicada a la cuenta de <b>{(client as { nombre: string }).nombre}</b>: preguntale
          cómo viene, qué optimizar o cómo lograr un objetivo. El análisis corre solo cuando vos lo
          pedís.
        </p>
      </div>

      {!metaConfigured() && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Falta conectar Meta (token del sistema). Avisale al admin.</span>
        </div>
      )}

      {!adAccountId ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm">
          <p className="text-muted-foreground">
            Este cliente todavía no tiene cargada su cuenta publicitaria (<code>act_XXXX</code>).
          </p>
          <Link
            href={`/clientes/${client.id}/pauta`}
            className="mt-2 inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Ir a Setup para cargarla
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs del último día registrado */}
          {s && (
            <div>
              <div className="mb-2 text-xs text-muted-foreground">
                Último día registrado: {s.fecha}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Gasto" value={`${moneda} ${fmt(s.spend)}`} />
                <Kpi label="Clicks" value={fmt(s.clicks)} />
                <Kpi label="CTR" value={s.ctr != null ? `${s.ctr}%` : "—"} />
                <Kpi label="CPC" value={s.cpc != null ? `${moneda} ${fmt(s.cpc)}` : "—"} />
                <Kpi label="Conversiones" value={fmt(s.conversions)} />
                <Kpi
                  label="Costo/conv"
                  value={s.cost_per_conversion != null ? `${moneda} ${fmt(s.cost_per_conversion)}` : "—"}
                />
              </div>
            </div>
          )}

          {/* Chat con la IA de la cuenta */}
          <PaidMediaChat clienteId={client.id} />
        </>
      )}
    </div>
  );
}
