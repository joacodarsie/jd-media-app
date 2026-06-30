import Link from "next/link";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { AgencyPageDialog } from "@/components/agency-page-dialog";
import { QuickLinksManager, type QuickLinkRow } from "@/components/quick-links-manager";
import { ServicesManager } from "@/components/services-manager";
import { SectionTabs } from "@/components/section-tabs";
import { conocimientoTabs } from "@/lib/section-tabs";
import type { ServiceInit } from "@/components/service-dialog";

// Contenido estable de la agencia (SOPs, services). Revalida cada 60s.
export const revalidate = 60;

export default async function AgenciaPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [pagesRes, linksRes, servicesRes] = await Promise.all([
    supabase
      .from("agency_pages")
      .select("slug, title, kind, orden, content, notion_url, updated_at")
      .in("kind", ["fundamentos", "buyer_persona"])
      .order("kind")
      .order("orden"),
    supabase
      .from("quick_links")
      .select("id, label, url, icon, orden")
      .order("orden"),
    supabase
      .from("services")
      .select("slug, name, description, color, icon, areas, orden, active")
      .order("orden"),
  ]);

  const pages = pagesRes.data;
  const links: QuickLinkRow[] = (linksRes.data ?? []) as QuickLinkRow[];
  const services: ServiceInit[] = (servicesRes.data ?? []) as ServiceInit[];
  const canEdit = isStaffUser(me);

  return (
    <div className="space-y-5">
      <SectionTabs tabs={conocimientoTabs} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agencia</h1>
          <p className="text-muted-foreground">
            Quiénes somos, qué hacemos y a quién le hablamos.
          </p>
        </div>
        {canEdit && (
          <AgencyPageDialog
            mode="create"
            defaultKind="fundamentos"
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nueva página
              </Button>
            }
          />
        )}
      </div>

      <ServicesManager services={services} canEdit={canEdit} />

      <QuickLinksManager links={links} canEdit={canEdit} />

      <div className="grid gap-4 lg:grid-cols-2">
        {(pages ?? []).map((p) => (
          <Card key={p.slug}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle className="text-base">{p.title}</CardTitle>
              {canEdit && (
                <AgencyPageDialog
                  mode="edit"
                  page={p}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              <Markdown>{p.content.slice(0, 600) + (p.content.length > 600 ? "…" : "")}</Markdown>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <Link
                  href={`/agencia/${p.slug}`}
                  className="inline-flex items-center font-medium text-primary hover:underline"
                >
                  Leer completo <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
                {p.notion_url && (
                  <a
                    href={p.notion_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground"
                  >
                    Notion <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
