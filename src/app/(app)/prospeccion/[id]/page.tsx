import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Send, Languages, Target, Table2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { ProspectingCampaignDialog } from "@/components/prospecting-campaign-dialog";
import { ProspectingCampaignActions } from "@/components/prospecting-campaign-actions";
import {
  ProspectingCampaignMessages,
  type CampaignMessages,
} from "@/components/prospecting-campaign-messages";
import { channelLabel, langLabel, leadStats } from "@/lib/prospecting/shared";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { nuevo?: string };
}) {
  // Los mensajes plantilla los puede generar todo el equipo de Prospección: es
  // una llamada por campaña y sin ellos no se puede escribir. Lo que escala con
  // el uso ("Sacar contactos con IA") sigue con el permiso `contactos_ia`.
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

  // Plantilla de mensajes de la campaña (resiliente si falta la 0132).
  let mensajesPlantilla: CampaignMessages | null = null;
  const mp = await admin
    .from("prospecting_campaigns")
    .select("mensajes_plantilla")
    .eq("id", c.id)
    .maybeSingle();
  if (!mp.error)
    mensajesPlantilla =
      ((mp.data as { mensajes_plantilla?: CampaignMessages | null } | null)?.mensajes_plantilla) ?? null;

  // El embudo se mide sobre los CONTACTOS, que es por donde se escribe ahora.
  const { data: contactosData } = await admin
    .from("prospecting_contacts")
    .select("estado")
    .eq("campaign_id", c.id);
  const contactosEstados = ((contactosData ?? []) as { estado: string | null }[])
    .map((x) => x.estado)
    .filter((e): e is string => !!e);
  const contactosCount = (contactosData ?? []).length;

  const stats = leadStats(contactosEstados);

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

      {/* Mensajes ideales de la campaña */}
      <ProspectingCampaignMessages
        campaignId={c.id}
        initial={mensajesPlantilla}
        canGenerate
        autoGenerate={searchParams?.nuevo === "1" && !mensajesPlantilla}
      />

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

      {/* El único camino: la lista de contactos para escribir a mano en volumen.
          El flujo viejo de "leads" (buscar con IA de a uno + mensaje por lead)
          se sacó en agosto 2026: duplicaba el trabajo de Contactos y nadie lo
          usaba. Los leads viejos siguen en la base (prospecting_leads). */}
      <Link
        href={`/prospeccion/${c.id}/contactos`}
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5 transition hover:bg-accent"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <Table2 className="h-5 w-5 text-primary" /> Contactos de esta campaña
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {contactosCount > 0
              ? `${contactosCount} contactos cargados. Entrá para escribirles.`
              : "Todavía no hay contactos. Entrá y tocá “Sacar contactos”."}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-primary">Abrir →</span>
      </Link>
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
