import Link from "next/link";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { AgencyPageDialog } from "@/components/agency-page-dialog";

export const dynamic = "force-dynamic";

export default async function AgenciaPage() {
  const me = await requireUser();
  const supabase = createClient();

  const { data: pages } = await supabase
    .from("agency_pages")
    .select("*")
    .in("kind", ["fundamentos", "buyer_persona", "accesos"])
    .order("kind")
    .order("orden");

  const canEdit = isStaff(me.rol);

  return (
    <div className="space-y-5">
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
