import Link from "next/link";
import { Radar, Clock, ChevronDown } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { equipoQueEscribe } from "@/lib/prospecting/equipo";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectingCampaignDialog } from "@/components/prospecting-campaign-dialog";
import {
  ProspectingCampaignsBrowser,
  type CampaniaCard,
} from "@/components/prospecting-campaigns-browser";
import { ultimoUso } from "@/lib/prospecting/campanias-lista";
import {
  channelLabel,
  leadStats,
  diasDesde,
  SEGUIMIENTO_DIAS,
} from "@/lib/prospecting/shared";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];

export default async function ProspeccionPage() {
  // El acceso a la sección ya es el permiso: adentro, todo el equipo de
  // prospección puede usar "Sugerir con IA" al crear una campaña.
  const me = await requireRole(ALLOWED);
  const admin = createAdmin();
  const equipo = await equipoQueEscribe();

  const { data: campaigns, error } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, canal, estado, created_at, ultima_apertura_at")
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
    ultima_apertura_at?: string | null;
  }[];

  // Leads para conteos, métricas por campaña y "para seguir".
  const { data: leads } = await admin
    .from("prospecting_leads")
    .select("id, empresa, campaign_id, estado, contactado_at, created_at");
  type LeadLite = {
    id: string;
    empresa: string;
    campaign_id: string;
    estado: string;
    contactado_at: string | null;
    created_at: string | null;
  };
  const leadRows = (leads ?? []) as LeadLite[];

  // Lo último que se trabajó en cada campaña (contactos del modo rápido). Con
  // los más recientes alcanza: lo que importa es encontrar la campaña en uso.
  const { data: contactosRecientes } = await admin
    .from("prospecting_contacts")
    .select("campaign_id, updated_at, contactado_at")
    .order("updated_at", { ascending: false })
    .limit(1000);
  const actividadBy = new Map<string, string[]>();
  const anotar = (id: string | null, f: string | null | undefined) => {
    if (!id || !f) return;
    if (!actividadBy.has(id)) actividadBy.set(id, []);
    actividadBy.get(id)!.push(f);
  };
  for (const ct of (contactosRecientes ?? []) as {
    campaign_id: string | null;
    updated_at: string | null;
    contactado_at: string | null;
  }[]) {
    anotar(ct.campaign_id, ct.updated_at);
    anotar(ct.campaign_id, ct.contactado_at);
  }
  for (const l of leadRows) {
    anotar(l.campaign_id, l.created_at);
    anotar(l.campaign_id, l.contactado_at);
  }

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

  const tarjetas: CampaniaCard[] = rows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    rubro: c.rubro,
    ubicacion: c.ubicacion,
    created_at: c.created_at,
    ultimoUso: ultimoUso(c.created_at, [c.ultima_apertura_at, ...(actividadBy.get(c.id) ?? [])]),
    canalLabel: channelLabel(c.canal),
    estado: c.estado,
    total: totalBy.get(c.id) ?? 0,
    ganados: wonBy.get(c.id) ?? 0,
    tasaRespuesta: leadStats(estadosBy.get(c.id) ?? []).tasaRespuesta ?? null,
  }));

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/prospeccion/actividad"
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            📊 ¿Quién escribe?
          </Link>
          <Link
            href="/prospeccion/email"
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            ✉️ Email en frío
          </Link>
          <Link
            href="/prospeccion/propuestas"
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            📄 Propuestas
          </Link>
          <ProspectingCampaignDialog
            mode="create"
            services={services}
            equipo={equipo}
            yoId={me.id}
            canSuggest
          />
        </div>
      </div>

      {paraSeguir.length > 0 && (
        // Plegado: ocupaba media pantalla y casi no se usaba (pedido del
        // dueño, 5/10). Queda una línea que se abre si hace falta.
        <details className="group rounded-lg border border-amber-300/60 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" />
            <span>
              <b>{paraSeguir.length}</b> contactados hace {SEGUIMIENTO_DIAS}+ días sin respuesta
            </span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 divide-y divide-amber-200/60 dark:divide-amber-500/20">
            {paraSeguir.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/prospeccion/${l.campaign_id}`}
                  className="flex items-center justify-between gap-3 py-1.5 hover:opacity-80"
                >
                  <span className="min-w-0 truncate font-medium">{l.empresa}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="hidden truncate sm:inline">{nombreCampaña.get(l.campaign_id)}</span>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      hace {l.dias}d
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            El seguimiento se manda desde la campaña, con el botón <b>Generar seguimiento</b>.
          </p>
        </details>
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
            <ProspectingCampaignDialog
              mode="create"
              services={services}
              equipo={equipo}
              yoId={me.id}
              canSuggest
            />
          </CardContent>
        </Card>
      ) : (
        <ProspectingCampaignsBrowser campanias={tarjetas} />
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
