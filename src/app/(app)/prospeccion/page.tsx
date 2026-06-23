import Link from "next/link";
import { Radar, ArrowRight, MapPin, Send } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectingCampaignDialog } from "@/components/prospecting-campaign-dialog";
import { channelLabel } from "@/lib/prospecting/shared";

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

  // Conteo de leads por campaña (total + ganados).
  const { data: leads } = await admin
    .from("prospecting_leads")
    .select("campaign_id, estado");
  const totalBy = new Map<string, number>();
  const wonBy = new Map<string, number>();
  for (const l of (leads ?? []) as { campaign_id: string; estado: string }[]) {
    totalBy.set(l.campaign_id, (totalBy.get(l.campaign_id) ?? 0) + 1);
    if (l.estado === "ganado") wonBy.set(l.campaign_id, (wonBy.get(l.campaign_id) ?? 0) + 1);
  }

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
                <div className="mt-3 flex gap-3 text-sm">
                  <span><b>{total}</b> leads</span>
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
