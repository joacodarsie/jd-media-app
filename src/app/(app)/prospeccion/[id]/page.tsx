import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Send, Languages, Target } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectingCampaignDialog } from "@/components/prospecting-campaign-dialog";
import { ProspectingCampaignActions } from "@/components/prospecting-campaign-actions";
import { ProspectingDiscoverButton } from "@/components/prospecting-discover-button";
import { ProspectingGenerateAllButton } from "@/components/prospecting-generate-all-button";
import { ProspectingManualLeadDialog } from "@/components/prospecting-manual-lead-dialog";
import { ProspectingLeadCard, type LeadRow } from "@/components/prospecting-lead-card";
import { channelLabel, langLabel, LEAD_ESTADOS, leadStats } from "@/lib/prospecting/shared";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];

// Orden de los leads: primero los “vivos” por fit, los descartados al final.
const ESTADO_ORDER: Record<string, number> = {
  respondio: 0,
  reunion: 1,
  contactado: 2,
  nuevo: 3,
  ganado: 4,
  descartado: 5,
};

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(ALLOWED);
  const admin = createAdmin();

  const { data: camp } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, servicio, angulo, canal, idioma, estado")
    .eq("id", params.id)
    .maybeSingle();
  if (!camp) notFound();
  const c = camp as {
    id: string;
    nombre: string;
    rubro: string;
    ubicacion: string | null;
    servicio: string | null;
    angulo: string | null;
    canal: string;
    idioma: string;
    estado: string;
  };

  const { data: svc } = await admin
    .from("services")
    .select("slug, name")
    .eq("active", true)
    .order("orden");
  const services = (svc ?? []) as { slug: string; name: string }[];
  const servicioNombre = services.find((s) => s.slug === c.servicio)?.name ?? null;

  const LEAD_COLS =
    "id, empresa, descripcion, ciudad, pais, sitio_web, instagram, instagram_verificado, telefono, email, por_que, fit_score, fuente_url, mensaje, seguimiento, estado, cliente_id";
  const leadsRes = await admin
    .from("prospecting_leads")
    .select(LEAD_COLS)
    .eq("campaign_id", c.id);
  let leadsData = leadsRes.data;
  const leadsErr = leadsRes.error;
  // Resiliencia: si todavía no se aplicaron 0099 (seguimiento) o 0112
  // (instagram_verificado), no rompemos la página — traemos sin esas columnas.
  if (leadsErr && (leadsErr as { code?: string }).code === "42703") {
    const fallback = await admin
      .from("prospecting_leads")
      .select(LEAD_COLS.replace(", seguimiento", "").replace(", instagram_verificado", ""))
      .eq("campaign_id", c.id);
    leadsData = ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map(
      (l) => ({ ...l, seguimiento: null, instagram_verificado: null })
    ) as typeof leadsData;
  }

  const leads = ((leadsData ?? []) as Omit<LeadRow, "canal">[]).sort((a, b) => {
    const eo = (ESTADO_ORDER[a.estado] ?? 9) - (ESTADO_ORDER[b.estado] ?? 9);
    if (eo !== 0) return eo;
    return (b.fit_score ?? -1) - (a.fit_score ?? -1);
  });

  const counts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.estado] = (acc[l.estado] ?? 0) + 1;
    return acc;
  }, {});

  // Leads activos sin mensaje todavía (para el botón "Generar mensajes").
  const sinMensaje = leads.filter(
    (l) => !l.mensaje && l.estado !== "descartado"
  ).length;

  const stats = leadStats(leads.map((l) => l.estado));

  return (
    <div className="space-y-5">
      <Link
        href="/prospeccion"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Prospección
      </Link>

      {/* Header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{c.nombre}</h1>
              {c.estado === "pausada" && (
                <Badge className="bg-muted text-muted-foreground">pausada</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{c.rubro}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {c.ubicacion && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {c.ubicacion}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Send className="h-3 w-3" /> {channelLabel(c.canal)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Languages className="h-3 w-3" /> {langLabel(c.idioma)}
              </span>
              {servicioNombre && (
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" /> {servicioNombre}
                </span>
              )}
            </div>
            {c.angulo && (
              <p className="mt-2 max-w-2xl rounded-lg bg-primary/5 px-3 py-2 text-sm">
                {c.angulo}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProspectingCampaignDialog
              mode="edit"
              campaign={{
                id: c.id,
                nombre: c.nombre,
                rubro: c.rubro,
                ubicacion: c.ubicacion,
                servicio: c.servicio,
                angulo: c.angulo,
                canal: c.canal,
                idioma: c.idioma,
              }}
              services={services}
            />
            <ProspectingCampaignActions id={c.id} estado={c.estado} nombre={c.nombre} />
          </div>
        </div>
      </div>

      {/* Métricas del embudo */}
      {stats.contactados > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Contactados" value={`${stats.contactados}`} />
          <Stat
            label="Tasa de respuesta"
            value={stats.tasaRespuesta != null ? `${stats.tasaRespuesta}%` : "—"}
            sub={`${stats.respondieron} respondieron`}
          />
          <Stat
            label="Conversión"
            value={stats.tasaConversion != null ? `${stats.tasaConversion}%` : "—"}
            sub={`${stats.ganados} ganados`}
          />
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ProspectingDiscoverButton campaignId={c.id} />
          {sinMensaje > 0 && (
            <ProspectingGenerateAllButton campaignId={c.id} count={sinMensaje} />
          )}
          <ProspectingManualLeadDialog campaignId={c.id} />
        </div>
        {leads.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {LEAD_ESTADOS.filter((e) => counts[e.value]).map((e) => (
              <Badge key={e.value} className={e.badge}>
                {counts[e.value]} {e.label.toLowerCase()}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Leads */}
      {leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">Sin leads todavía</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Tocá <b>Buscar leads con IA</b> y la IA sale a buscar empresas reales
              del cluster con sus datos de contacto. O cargá una a mano si ya la
              tenés.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {leads.map((l) => (
            <ProspectingLeadCard key={l.id} lead={{ ...l, canal: c.canal }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
