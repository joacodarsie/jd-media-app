import Link from "next/link";
import { Radar, ArrowRight, MapPin, Send, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectingCampaignDialog } from "@/components/prospecting-campaign-dialog";
import {
  channelLabel,
  leadStats,
  diasDesde,
  SEGUIMIENTO_DIAS,
} from "@/lib/prospecting/shared";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];

export default async function ProspeccionPage() {
  await requireRole(ALLOWED);
  const admin = createAdmin();

  const { data: campaigns, error } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, canal, estado, created_at")
    .order("created_at", { ascending: false });

  if (error && (error as { code?: string }).code === "42P01") {
    return <MigrationNotice />;
  }

  const rows = (campaigns ?? []) as {
    id: string;
    nombre: string;
    rubro: string;
    ubicacion: string | null;
    canal: string;
    estado: string;
    created_at: string;
  }[];

  // Leads para conteos, métricas por campaña y "para seguir".
  const { data: leads } = await admin
    .from("prospecting_leads")
    .select("id, empresa, campaign_id, estado, contactado_at");
  type LeadLite = {
    id: string;
    empresa: string;
    campaign_id: string;
    estado: string;
    contactado_at: string | null;
  };
  const leadRows = (leads ?? []) as LeadLite[];

  const totalBy = new Map<string, number>();
  const wonBy = new Map<string, number>();
  const estadosBy = new Map<string, string[]>();
  for (const l of leadRows) {
    totalBy.set(l.campaign_id, (totalBy.get(l.campaign_id) ?? 0) + 1);
    if (l.estado === "ganado") wonBy.set(l.campaign_id, (wonBy.get(l.campaign_id) ?? 0) + 1);
    if (!estadosBy.has(l.campaign_id)) estadosBy.set(l.campaign_id, []);
    estadosBy.get(l.campaign_id)!.push(l.estado);
  }
  const nombreCampaña = new Map(rows.map((c) => [c.id, c.nombre]));

  // "Para seguir": contactados sin respuesta hace ≥ SEGUIMIENTO_DIAS días.
  const paraSeguir = leadRows
    .filter((l) => l.estado === "contactado")
    .map((l) => ({ ...l, dias: diasDesde(l.contactado_at) }))
    .filter((l) => l.dias != null && l.dias >= SEGUIMIENTO_DIAS)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
    .slice(0, 12);

  const { data: svc } = await admin
    .from("services")
    .select("slug, name")
    .eq("active", true)
    .order("orden");
  const services = (svc ?? []) as { slug: string; name: string }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Radar className="h-6 w-6 text-primary" /> Prospección
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Captá clientes sin depender solo de la pauta. Creás una campaña por
            <b> cluster</b> (un rubro en una zona), la IA busca empresas reales que
            nos necesitan y te arma un mensaje personalizado para cada una. Vos lo
            mandás por WhatsApp o Instagram.
          </p>
        </div>
        <ProspectingCampaignDialog mode="create" services={services} />
      </div>

      {paraSeguir.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" /> Para seguir ({paraSeguir.length})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Contactados hace {SEGUIMIENTO_DIAS}+ días sin respuesta. Mandales el
            seguimiento (en la campaña, botón <b>Generar seguimiento</b>).
          </p>
          <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
            {paraSeguir.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/prospeccion/${l.campaign_id}`}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm hover:opacity-80"
                >
                  <span className="min-w-0 truncate font-medium">{l.empresa}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="hidden truncate sm:inline">
                      {nombreCampaña.get(l.campaign_id)}
                    </span>
                    <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100">
                      hace {l.dias}d
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Radar className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Todavía no hay campañas</p>
              <p className="text-sm text-muted-foreground">
                Empezá con un cluster bien afilado, ej: <i>“restaurantes de Nueva
                Córdoba”</i> o <i>“estudios de abogados en Madrid”</i>.
              </p>
            </div>
            <ProspectingCampaignDialog mode="create" services={services} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const total = totalBy.get(c.id) ?? 0;
            const won = wonBy.get(c.id) ?? 0;
            const stats = leadStats(estadosBy.get(c.id) ?? []);
            return (
              <Link
                key={c.id}
                href={`/prospeccion/${c.id}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{c.nombre}</h3>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.rubro}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {c.ubicacion && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.ubicacion}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Send className="h-3 w-3" /> {channelLabel(c.canal)}
                  </span>
                  {c.estado === "pausada" && <Badge className="bg-muted text-muted-foreground">pausada</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span><b>{total}</b> leads</span>
                  {stats.tasaRespuesta != null && (
                    <span className="text-muted-foreground">
                      <b>{stats.tasaRespuesta}%</b> respuesta
                    </span>
                  )}
                  {won > 0 && <span className="text-emerald-600 dark:text-emerald-400"><b>{won}</b> ganados</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Radar className="h-6 w-6 text-primary" /> Prospección
      </h1>
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="font-medium">Falta aplicar la migración 0097</p>
          <p className="text-sm text-muted-foreground">
            Corré <code>0097_prospecting.sql</code> en Supabase y recargá. Después
            podés crear tu primera campaña.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
